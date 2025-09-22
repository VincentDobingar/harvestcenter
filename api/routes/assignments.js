// 📁 backend/routes/assignments.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import verifyUserToken from "../middlewares/verifyUserToken.js";
import {
  listAssignments,
  createAssignment,
  getAssignment,
  submitAssignment,
  gradeSubmission,
} from "../controllers/assignments.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier d'upload: backend/uploads/assignments
const uploadRoot = path.resolve(__dirname, "..", "uploads", "assignments");
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

const router = Router();

router.post("/submissions/:id/grade", verifyUserToken, gradeSubmission);
router.get("/", verifyUserToken, listAssignments);
router.post("/", verifyUserToken, createAssignment);          // trainer/admin
router.get("/:id", verifyUserToken, getAssignment);
router.post("/:id/submissions", verifyUserToken, submitAssignment);
router.post("/submissions/:id/grade", verifyUserToken, gradeSubmission); // trainer/admin
export default router;
