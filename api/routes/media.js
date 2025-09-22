// 📁 backend/routes/media.js (ou ~/harvestcentertd.org/api/routes/media.js)
import { Router } from "express";
import { pool } from "../config/db.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminToken } from "../middlewares/verifyAdminToken.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Config S3
 * - S3_PUBLIC_BASE : base publique (ex: https://cdn…/bucket) pour détecter les clés
 * - S3_BUCKET / AWS_REGION : nécessaires pour activer S3
 */
const S3_PUBLIC_BASE = (process.env.S3_PUBLIC_BASE || "").replace(/\/$/, "");
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.AWS_REGION;

const s3 = (S3_BUCKET && S3_REGION)
  ? new S3Client({ region: S3_REGION })
  : null; // tolère absence S3 (suppression locale uniquement)

/** Transforme une URL publique en clé S3 si elle appartient à la base S3_PUBLIC_BASE */
function urlToS3Key(url) {
  if (!S3_PUBLIC_BASE) return null;
  if (url.startsWith(S3_PUBLIC_BASE + "/")) {
    return url.slice(S3_PUBLIC_BASE.length + 1);
  }
  return null;
}

/** Transforme une URL /uploads/... en chemin local sur le disque */
function urlToLocalPath(url) {
  // ex: /uploads/2025/08/xxx.jpg
  if (!url.startsWith("/uploads/")) return null;
  const root = path.resolve(__dirname, "..", ".."); // remonte au dossier racine de l’app (api/)
  return path.join(root, url.replace(/^\//, ""));   // api/uploads/...
}

/**
 * POST /api/media
 * body: { url, title?, alt_text?, category?, taken_at?, type? }
 * type auto = image|video selon extension si non fourni
 * Protégé côté routeur parent si nécessaire (sinon on peut ajouter verifyAdminToken ici)
 */
router.post("/", async (req, res) => {
  try {
    const { url, title, alt_text, category, taken_at, type } = req.body;
    if (!url) return res.status(400).json({ error: "url requis (résultat /api/uploads)" });

    const isVideo = /\.mp4(\?.*)?$/i.test(url);
    const t = type || (isVideo ? "video" : "image");

    const { rows } = await pool.query(
      `INSERT INTO harvestcenter.media(type, url, title, alt_text, category, taken_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6, TRUE)
       RETURNING *`,
      [t, url, title || null, alt_text || null, category || null, taken_at || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Échec de création media" });
  }
});

/** Public: GET /api/media?category=&limit=&offset= */
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const limit = Number.isFinite(+req.query.limit) ? +req.query.limit : 24;
    const offset = Number.isFinite(+req.query.offset) ? +req.query.offset : 0;

    const params = [limit, offset];
    let sql = `SELECT * FROM harvestcenter.media WHERE is_active=TRUE`;
    if (category) { sql += ` AND category=$3`; params.push(category); }
    sql += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Échec de lecture media" });
  }
});

/**
 * DELETE /api/media/:id
 * Protégé par token admin
 * (si tu veux restreindre aux rôles spécifiques, ajoute une vérif sur req.user?.role / req.admin?.role)
 */
router.delete("/:id", verifyAdminToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id invalide" });

    // 1) récupérer la ligne
    const { rows } = await client.query(
      `SELECT id, url FROM harvestcenter.media WHERE id=$1 LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Média introuvable" });

    const { url } = rows[0];

    // 2) supprimer le fichier (S3 ou local)
    const s3Key = urlToS3Key(url);
    const localPath = urlToLocalPath(url);

    if (s3Key && s3) {
      // S3
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      } catch (e) {
        // On loggue mais on continue: on supprimera tout de même en base
        console.error("S3 delete error:", e?.message || e);
      }
    } else if (localPath) {
      // Local
      try {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      } catch (e) {
        console.error("Local delete error:", e?.message || e);
      }
    } // sinon: URL externe/CDN -> on supprime juste en base

    // 3) supprimer en base
    const del = await client.query(`DELETE FROM harvestcenter.media WHERE id=$1`, [id]);
    if (del.rowCount !== 1) {
      return res.status(500).json({ error: "Échec suppression base" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Échec suppression média" });
  } finally {
    client.release();
  }
});

export default router;
