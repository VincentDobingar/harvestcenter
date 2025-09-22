// 📁 api/controllers/admin.controller.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { sendMail } from "../utils/mailer.js";
import { verifyRecaptcha } from "../utils/recaptcha.js";


const signToken = (admin) => {
  const payload = { id: admin.id, email: admin.email, role: admin.role };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "3h",
  });
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, motdepasse } = req.body;
    if (!email || !motdepasse) {
      return res.status(400).json({ message: "Email et mot de passe requis." });
    }

    const result = await pool.query("SELECT * FROM administrateurs WHERE email=$1 LIMIT 1", [email]);
    const admin = result.rows[0];
    if (!admin) return res.status(401).json({ message: "Identifiants invalides." });

    const ok = await bcrypt.compare(motdepasse, admin.motdepasse);
    if (!ok) return res.status(401).json({ message: "Identifiants invalides." });

    const token = signToken(admin);
    return res.json({
      token,
      role: admin.role,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    });
  } catch (e) {
    console.error("loginAdmin error:", e);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

function validatePasswordComplexity(password, email) {
  // Politique: 10+ caractères, AU + alphanum + spécial, au moins 3 classes (minuscule, majuscule, chiffre, spécial)
  if (!password || password.length < 10) {
    return "Le mot de passe doit contenir au moins 10 caractères.";
  }
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const digit = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const classes = [lower, upper, digit, special].filter(Boolean).length;
  if (classes < 3) {
    return "Le mot de passe doit contenir au moins trois types: minuscule, majuscule, chiffre, caractère spécial.";
  }
  // éviter parties d’email évidentes
  if (email) {
    const local = String(email).split("@")[0];
    if (local && password.toLowerCase().includes(local.toLowerCase())) {
      return "Le mot de passe ne doit pas contenir votre email.";
    }
  }
  // blacklist simple
  const banned = ["harvest", "password", "motdepasse", "azerty", "qwerty", "123456", "admin"];
  if (banned.some((w) => password.toLowerCase().includes(w))) {
    return "Choisissez un mot de passe plus robuste (évitez les termes courants).";
  }
  return null; // ok
}

export const getAdminProfile = async (req, res) => {
  // req.admin défini par verifyAdminToken
  res.json({ admin: req.admin });
};


export const createSuperAdmin = async (req, res) => {
  try {
    const { email, motdepasse } = req.body;
    if (!email || !motdepasse) return res.status(400).json({ message: "Champs manquants." });

    // S'il existe déjà un superAdmin, on bloque (optionnel)
    const existing = await pool.query("SELECT 1 FROM administrateurs WHERE role='superAdmin' LIMIT 1");
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: "Un superAdmin existe déjà." });
    }

    const hash = await bcrypt.hash(motdepasse, 10);
    const insert = await pool.query(
      "INSERT INTO administrateurs (email, motdepasse, role) VALUES ($1,$2,'superAdmin') RETURNING id, email, role",
      [email, hash]
    );
    res.status(201).json({ message: "SuperAdmin créé.", admin: insert.rows[0] });
  } catch (e) {
    console.error("createSuperAdmin error:", e);
    if (e.code === "23505") {
      return res.status(409).json({ message: "Email déjà utilisé." });
    }
    res.status(500).json({ message: "Erreur serveur." });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { email, motdepasse, role = "admin" } = req.body;
    if (!email || !motdepasse) return res.status(400).json({ message: "Champs manquants." });

    const hash = await bcrypt.hash(motdepasse, 10);
    const insert = await pool.query(
      "INSERT INTO administrateurs (email, motdepasse, role) VALUES ($1,$2,$3) RETURNING id, email, role",
      [email, hash, role]
    );
    res.status(201).json({ message: "Administrateur créé.", admin: insert.rows[0] });
  } catch (e) {
    console.error("createAdmin error:", e);
    if (e.code === "23505") {
      return res.status(409).json({ message: "Email déjà utilisé." });
    }
    res.status(500).json({ message: "Erreur serveur." });
  }
};

export const listAdmins = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, role, cree_le FROM administrateurs ORDER BY cree_le DESC"
    );
    res.json(rows);
  } catch (e) {
    console.error("listAdmins error:", e);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email, token } = req.body; // token reCAPTCHA v3
    if (!email) return res.status(400).json({ message: "Email requis." });

    // ✅ reCAPTCHA v3
    const check = await verifyRecaptcha(token, req.ip, "admin_forgot");
    if (!check.ok) {
      return res.status(400).json({ message: "Vérification reCAPTCHA échouée." });
    }

    const { rows } = await pool.query(
      "SELECT id, email FROM administrateurs WHERE email=$1 LIMIT 1",
      [email]
    );
    const admin = rows[0];

    // Réponse générique
    const generic = { message: "Si le compte existe, un lien a été envoyé par email." };
    if (!admin) return res.json(generic);

    const jwtToken = jwt.sign(
      { id: admin.id, purpose: "reset" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.RESET_EXPIRES_IN || "30m" }
    );

    const link = `${process.env.FRONTEND_URL}/admin/reset-password/${encodeURIComponent(jwtToken)}`;

    await sendMail({
      to: admin.email,
      subject: "Réinitialisation de mot de passe — Harvest Center",
      html: `
        <p>Bonjour,</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable ${
          process.env.RESET_EXPIRES_IN || "30m"
        } :</p>
        <p><a href="${link}">${link}</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        <p>— Harvest Center</p>
      `,
    });

    return res.json(generic);
  } catch (e) {
    console.error("forgotPassword error:", e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { motdepasse } = req.body;

    if (!token || !motdepasse) return res.status(400).json({ message: "Données manquantes." });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Lien invalide ou expiré." });
    }
    if (decoded?.purpose !== "reset" || !decoded?.id) {
      return res.status(400).json({ message: "Lien invalide." });
    }

    // Récupérer l'email pour la règle "password ne contient pas l'email"
    const { rows } = await pool.query("SELECT email FROM administrateurs WHERE id=$1 LIMIT 1", [decoded.id]);
    const admin = rows[0];
    const complexityError = validatePasswordComplexity(motdepasse, admin?.email);
    if (complexityError) {
      return res.status(400).json({ message: complexityError });
    }

    const hash = await bcrypt.hash(motdepasse, 10);
    await pool.query("UPDATE administrateurs SET motdepasse=$1 WHERE id=$2", [hash, decoded.id]);

    return res.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter." });
  } catch (e) {
    console.error("resetPassword error:", e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};


export const refreshAdminToken = async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token manquant." });

    const payload = jwt.decode(token);
    const adminId = payload?.id || payload?.sub;
    if (!adminId) return res.status(400).json({ message: "Token invalide." });

    const { rows } = await pool.query("SELECT id, email, role FROM administrateurs WHERE id=$1 LIMIT 1", [adminId]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ message: "Admin introuvable." });

    const newToken = signToken(admin);
    return res.json({ token: newToken, admin: { id: admin.id, email: admin.email, role: admin.role } });
  } catch (e) {
    console.error("refreshAdminToken error:", e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * getAdminStats
 * Retourne des compteurs simples (tentative de requêtes sécurisées) — si une table n'existe pas,
 * on renvoie null pour ce compteur (évite crash SQL).
 */
export const getAdminStats = async (_req, res) => {
  try {
    const stats = {};

    // helper pour tenter une requête en capturant l'erreur si table manquante
    async function tryCount(table) {
      try {
        const r = await pool.query(`SELECT count(*) AS c FROM ${table}`);
        return Number(r.rows[0].c || 0);
      } catch (e) {
        return null; // table absente ou autre erreur -> null
      }
    }

    stats.users = await tryCount("users");
    stats.courses = await tryCount("courses");
    stats.enrollments = await tryCount("enrollments");
    stats.media = await tryCount("media");
    stats.assignments = await tryCount("assignments");

    return res.json({ stats });
  } catch (e) {
    console.error("getAdminStats error:", e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};


/**
 * updateAdmin
 * Met à jour un administrateur (email, role, motdepasse optionnel).
 * Paramètre : req.params.id
 */
export const updateAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const { email, role, motdepasse } = req.body;
    if (!id) return res.status(400).json({ message: "ID requis." });

    const fields = [];
    const values = [];
    let idx = 1;

    if (email) {
      fields.push(`email=$${idx++}`);
      values.push(email);
    }
    if (role) {
      fields.push(`role=$${idx++}`);
      values.push(role);
    }
    if (motdepasse) {
      const hash = await bcrypt.hash(motdepasse, 10);
      fields.push(`motdepasse=$${idx++}`);
      values.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Aucune donnée à mettre à jour." });
    }

    values.push(id);
    const q = `UPDATE administrateurs SET ${fields.join(", ")} WHERE id=$${idx} RETURNING id, email, role`;
    const { rows } = await pool.query(q, values);
    return res.json({ admin: rows[0] });
  } catch (e) {
    console.error("updateAdmin error:", e);
    if (e.code === "23505") return res.status(409).json({ message: "Email déjà utilisé." });
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * deleteAdmin
 * Supprime un admin par ID. Empêche suppression si c'est le dernier admin (sécurité basique).
 */
export const deleteAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "ID requis." });

    // compter admins
    const cRes = await pool.query("SELECT count(*) AS c FROM administrateurs");
    const total = Number(cRes.rows[0].c || 0);
    if (total <= 1) {
      return res.status(403).json({ message: "Impossible de supprimer le dernier administrateur." });
    }

    const { rowCount } = await pool.query("DELETE FROM administrateurs WHERE id=$1", [id]);
    if (!rowCount) return res.status(404).json({ message: "Administrateur introuvable." });
    return res.json({ message: "Administrateur supprimé." });
  } catch (e) {
    console.error("deleteAdmin error:", e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * resetDatabase
 * TRÈS DANGEREUX — implémentation sécurisée : seulement si la variable d'env ALLOW_DB_RESET === "1".
 * Par défaut renvoie 403.
 */
export const resetDatabase = async (req, res) => {
  try {
    if (process.env.ALLOW_DB_RESET !== "1") {
      return res.status(403).json({ message: "Reset DB désactivé sur ce serveur." });
    }
    // TODO: ajouter ici la logique de reset (DROP/TABLES/TRUNCATE) si tu veux l'activer
    return res.json({ message: "Reset DB autorisé (placeholder) — implémenter la logique avec prudence." });
  } catch (e) {
    console.error("resetDatabase error:", e);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};
