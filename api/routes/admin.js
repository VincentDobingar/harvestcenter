import express from "express";
import rateLimit from "express-rate-limit"; // ✅ ajoute ceci

import {
  loginAdmin,
  refreshAdminToken,
  forgotPassword,
  resetPassword,
  getAdminProfile,
  getAdminStats,
  createAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  createSuperAdmin,
  resetDatabase
} from "../controllers/admin.controller.js";

import verifyAdminToken from "../middlewares/verifyAdminToken.js";
import verifySuperAdmin from "../middlewares/verifySuperAdmin.js";

const router = express.Router();

// ✅ protection brute force login avec rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max tentatives
  message: "Trop de tentatives, réessayez plus tard."
});

// Auth
router.post("/login", limiter, loginAdmin);
router.post("/refresh", refreshAdminToken);

// Mot de passe
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Profil
router.get("/me", verifyAdminToken, getAdminProfile);

// Stats
router.get("/stats", verifyAdminToken, getAdminStats);

// Gestion admins (superAdmin seulement)
router.post("/", verifySuperAdmin, createAdmin);
router.get("/", verifySuperAdmin, listAdmins);
router.put("/:id", verifySuperAdmin, updateAdmin);
router.delete("/:id", verifySuperAdmin, deleteAdmin);

// Maintenance
router.post("/reset-database", verifySuperAdmin, resetDatabase);
router.post("/create-superadmin", createSuperAdmin);

export default router;
