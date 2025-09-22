// 📁 controllers/contact.controller.js
// Contrôleur d'envoi de message contact
// Utilise dynamic import pour nodemailer afin d'éviter un crash si le package n'est pas installé.

import { fileURLToPath } from "url"; // si tu veux logger emplacement (optionnel)
import path from "path";

const __filename = typeof fileURLToPath === "function" ? fileURLToPath(import.meta.url) : null;
const __dirname = __filename ? path.dirname(__filename) : null;

function log(...args) {
  // centralise les logs pour repérer l'origine dans les logs de Passenger
  console.log("[contact.controller]", ...args);
}

export const envoyerMessageContact = async (req, res) => {
  try {
    const { token, nom, email, sujet, message } = req.body || {};

    // Champs requis
    if (!nom || !email || !message || !sujet || !token) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    // --- reCAPTCHA verification ---
    try {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      if (!secretKey) {
        log("RECAPTCHA non configuré (RECAPTCHA_SECRET_KEY manquant) — bloquage pour sécurité");
        return res.status(500).json({ error: "reCAPTCHA non configuré côté serveur." });
      }

      const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(
        secretKey
      )}&response=${encodeURIComponent(token)}`;

      // Node 18+ fournit fetch globalement
      const response = await fetch(verifyUrl, { method: "POST" });
      const data = await response.json();

      if (!data.success || (typeof data.score === "number" && data.score < 0.5)) {
        log("reCAPTCHA échoué", data);
        return res.status(400).json({ error: "Échec vérification reCAPTCHA" });
      }
    } catch (err) {
      console.error("Erreur reCAPTCHA :", err);
      return res.status(500).json({ error: "Erreur vérification reCAPTCHA" });
    }

    // --- Nodemailer dynamic import (si présent) ---
    let nodemailerMod = null;
    try {
      nodemailerMod = await import("nodemailer");
    } catch (e) {
      // nodemailer non installé : on indique que le service mail n'est pas disponible
      log("nodemailer non installé — emails désactivés");
    }

    if (!nodemailerMod) {
      // On préfère répondre 501 pour indiquer que le service n'est pas configuré
      return res.status(501).json({ error: "Service d'envoi d'emails non configuré sur le serveur." });
    }

    const nodemailer = nodemailerMod.default || nodemailerMod;

    // Vérifier variables d'env SMTP
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;
    const EMAIL_ADMIN = process.env.EMAIL_ADMIN || EMAIL_USER;

    if (!EMAIL_USER || !EMAIL_PASS) {
      log("SMTP credentials manquantes (EMAIL_USER/EMAIL_PASS)");
      return res.status(500).json({ error: "Serveur mail mal configuré." });
    }

    // --- create transporter ---
    // Note : pour Gmail il faut souvent un app password et activer l'accès
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    // Optionnel : tester la connexion au transporteur (peut timeouter si mal config)
    try {
      // verify renvoie promise
      await transporter.verify();
    } catch (err) {
      console.error("SMTP verify failed:", err);
      return res.status(500).json({ error: "Impossible de se connecter au service SMTP." });
    }

    // --- Envoi au back-office (admin) ---
    const adminMailOptions = {
      from: `"${nom}" <${email}>`,
      to: EMAIL_ADMIN,
      subject: `Message depuis le site Harvest Center : ${sujet}`,
      html: `
        <h3>Vous avez reçu un message :</h3>
        <p><strong>Nom :</strong> ${escapeHtml(nom)}</p>
        <p><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p><strong>Sujet :</strong> ${escapeHtml(sujet)}</p>
        <p><strong>Message :</strong></p>
        <div>${escapeHtml(message).replace(/\n/g, "<br>")}</div>
      `,
    };

    await transporter.sendMail(adminMailOptions);

    // --- Accusé de réception au visiteur ---
    const autoReplyOptions = {
      from: `Harvest Center <${EMAIL_USER}>`,
      to: email,
      subject: `Confirmation : ${sujet}`,
      html: `
        <p>Bonjour ${escapeHtml(nom)},</p>
        <p>Nous avons bien reçu votre message concernant :</p>
        <p><strong>${escapeHtml(sujet)}</strong></p>
        <p>Nous vous remercions et reviendrons vers vous dans les plus brefs délais.</p>
        <br>
        <p>Cordialement,<br>Harvest Center</p>
      `,
    };

    await transporter.sendMail(autoReplyOptions);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Erreur envoyerMessageContact:", err && (err.stack || err.message || err));
    return res.status(500).json({ error: "Erreur serveur. Email non envoyé." });
  }
};

// Petite fonction utilitaire pour échapper HTML (éviter injection)
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
