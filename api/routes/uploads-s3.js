// 📁 backend/routes/uploads-s3.js
import { Router } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mime from "mime-types";

const router = Router();

const REGION  = process.env.AWS_REGION;
const BUCKET  = process.env.S3_BUCKET;
const PUBLIC  = process.env.S3_PUBLIC_BASE;      // ex: https://<bucket>.s3.<region>.amazonaws.com ou ton CDN
const PREFIX  = (process.env.S3_PREFIX || "uploads").replace(/^\/|\/$/g, "");
const EXPIRES = Number(process.env.S3_EXPIRES_SECONDS || 300);
const MAX_MB  = Number(process.env.S3_MAX_MB || 8);

const s3 = new S3Client({ region: REGION });

router.get("/sign", async (req, res) => {
  try {
    const { filename, mime: mimeType, folder } = req.query;

    if (!mimeType) return res.status(400).json({ error: "Paramètre 'mime' requis." });

    const safeExt = mime.extension(mimeType) || "bin";
    const base = (filename || `file.${safeExt}`)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/\.+/g, "."); // normalise

    const now   = new Date();
    const y     = now.getUTCFullYear();
    const m     = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dir   = folder ? String(folder).replace(/[^a-z0-9/_-]+/ig, "") : "media";
    const key   = `${PREFIX}/${y}/${m}/${dir}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${base}`;

    const put = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mimeType,
      ACL: "public-read", // si le bucket n'est pas privé/CDN. Sinon supprime et gère via policy.
    });

    const uploadUrl = await getSignedUrl(s3, put, { expiresIn: EXPIRES });

    const publicUrl = `${(PUBLIC || "").replace(/\/$/, "")}/${key}`;
    return res.json({
      uploadUrl,       // URL pré-signée (PUT)
      publicUrl,       // URL publique finale
      key,             // clé S3
      expiresIn: EXPIRES,
      maxSizeBytes: MAX_MB * 1024 * 1024
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Échec de signature S3" });
  }
});

export default router;
