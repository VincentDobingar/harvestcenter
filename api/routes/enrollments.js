import { Router } from "express";
import verifyUserToken from "../middlewares/verifyUserToken.js";
import { myEnrollments, enroll } from "../controllers/enrollments.controller.js";
const router = Router();

router.get("/me", verifyUserToken, myEnrollments);
router.post("/", verifyUserToken, enroll);
export default router;
