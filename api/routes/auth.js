import { Router } from "express";
import { login, register, me } from "../controllers/auth.controller.js";
import { verifyUserToken } from "../middlewares/verifyUserToken.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.get("/me", verifyUserToken, me);

export default router;