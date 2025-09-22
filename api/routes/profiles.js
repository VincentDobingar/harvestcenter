import { Router } from "express";
import verifyUserToken from "../middlewares/verifyUserToken.js";
import { getMyProfile, upsertMyProfile } from "../controllers/profiles.controller.js";

const router = Router();
router.get("/me", verifyUserToken, getMyProfile);
router.put("/me", verifyUserToken, upsertMyProfile);
export default router;
