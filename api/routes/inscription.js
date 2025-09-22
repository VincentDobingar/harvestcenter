// 📁 routes/inscription.js
import { Router } from "express";
// import { pool } from "../config/db.js"; // si PostgreSQL
// import nodemailer from "nodemailer";     // si envoi email

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { nom, email, telephone, formation, message } = req.body;
    if (!nom || !email || !telephone || !formation) {
      return res.status(400).json({ message: "Champs obligatoires manquants." });
    }

    // ✅ Exemple d'insertion PostgreSQL :
    // await pool.query(
    //   `INSERT INTO inscriptions(nom, email, telephone, formation, message, created_at)
    //    VALUES ($1,$2,$3,$4,$5,NOW())`,
    //   [nom, email, telephone, formation, message || null]
    // );

    // ✅ Option : envoi d'un email d’accusé (via nodemailer)

    return res.status(201).json({ message: "Inscription reçue." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
