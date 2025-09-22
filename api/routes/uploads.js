// 📁 backend/routes/uploads.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || "uploads";
const maxMB = Number(process.env.MAX_UPLOAD_MB || 8);
const MAX_SIZE = maxMB * 1024 * 1024;

fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4"
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = new Date();
    const dir = path.join(uploadDir, `${d.getFullYear()}`, `${String(d.getMonth()+1).padStart(2, "0")}`);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const base = (file.originalname || "file")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-");
    const ext = path.extname(base) || `.${mime.extension(file.mimetype) || "bin"}`;
    cb(null, `${ts}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (ALLOWED.has(file.mimetype)) cb(null, true);
  else cb(new Error("Type de fichier non autorisé"), false);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// POST /api/uploads  (form-data: file)
router.post("/", upload.single("file"), (req, res) => {
  const f = req.file;
  const normalized = f.path.replace(/\\\\/g, "/");
  const i = normalized.lastIndexOf("/uploads/");
  const url = i >= 0 ? normalized.slice(i) : `/uploads/${path.relative(uploadDir, f.path).replace(/\\\\/g, "/")}`;
  return res.status(201).json({
    filename: f.filename,
    size: f.size,
    mimetype: f.mimetype,
    url
  });
});

export default router;
