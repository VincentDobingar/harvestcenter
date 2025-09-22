// routes/users.routes.js
import { Router } from "express";
import { publicRegister, adminCreateUser } from "../controllers/users.controller.js";
import { verifyAdminToken } from "../middlewares/verifyAdminToken.js";

const router = Router();

// Public: utilisé par Register.jsx / Account.jsx (onglet "Créer un compte")
router.post("/register", publicRegister);

// Admin: création via back-office (protégée)
router.post("/", verifyAdminToken, adminCreateUser);

export default router;
