// 📁 ~/harvestcentertd.org/api/routes/progress.js
import { Router } from "express";
import { toggleLesson, courseProgressForMe, listCourseProgress } from "../controllers/progress.controller.js";
import { verifyUserToken } from "../middlewares/verifyUserToken.js";
import { verifyAdminToken } from "../middlewares/verifyAdminToken.js";

const router = Router();

/**
 * POST /api/progress/toggle-lesson
 * Body: { course_id, lesson_id }
 * Protégé : utilisateur connecté
 * Retour : { ok: true, progress: {...} } (par ex)
 */
router.post("/toggle-lesson", verifyUserToken, async (req, res) => {
  try {
    // toggleLesson doit accepter (req.user, { course_id, lesson_id }) ou (req, body)
    // Ici on passe user + body pour rester flexible côté contrôleur
    const result = await toggleLesson(req.user, req.body);
    return res.json({ ok: true, progress: result });
  } catch (e) {
    console.error("toggleLesson error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Erreur lors du changement d'état de la leçon." });
  }
});

/**
 * GET /api/progress/course/:courseId
 * Récupère le progrès pour l'utilisateur courant sur un cours donné
 * Protégé : utilisateur connecté
 */
router.get("/course/:courseId", verifyUserToken, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const progress = await courseProgressForMe(req.user, courseId);
    return res.json({ ok: true, progress });
  } catch (e) {
    console.error("courseProgressForMe error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Erreur lors de la récupération du progrès." });
  }
});

/**
 * (Optionnel) Route admin pour lister le progrès de tous les utilisateurs sur un cours
 * GET /api/progress/all/:courseId
 * Protégé : admin
 */
router.get("/all/:courseId", verifyAdminToken, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const rows = await listCourseProgress(courseId);
    return res.json({ ok: true, rows });
  } catch (e) {
    console.error("listCourseProgress error:", e);
    return res.status(e.status || 500).json({ error: e.message || "Erreur lors de la lecture des progrès." });
  }
});

export default router;
