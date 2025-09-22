import { Router } from "express";
import verifyUserToken from "../middlewares/verifyUserToken.js";
import { listCourses, getCourseBySlug, createCourse } from "../controllers/courses.controller.js";
const router = Router();

router.get("/", listCourses);
router.get("/:slug", getCourseBySlug);
router.post("/", verifyUserToken, createCourse); // trainer/admin
export default router;
