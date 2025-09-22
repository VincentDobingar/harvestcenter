// controllers/users.controller.js
import bcrypt from "bcryptjs";              // ⬅︎ bcryptjs (pas bcrypt natif)
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

const norm = {
  text: (v) => String(v || "").trim(),
  email: (v) => String(v || "").trim().toLowerCase(),
  username: (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 20),
};

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role || "user" },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

async function ensureUniqueUsername(base) {
  const root = norm.username(base) || `user${Math.floor(Math.random() * 10000)}`;
  let candidate = root;
  let i = 0;
  // on limite raisonnablement la boucle
  while (i < 1000) {
    const { rows } = await pool.query(
      "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
      [candidate]
    );
    if (!rows.length) return candidate;
    i += 1;
    const suffix = String(i);
    candidate = `${root.slice(0, Math.max(1, 20 - suffix.length))}${suffix}`;
  }
  // fallback au cas improbable
  return `${root}${Date.now().toString().slice(-3)}`;
}

/* ================== Inscription publique ================== */
export async function publicRegister(req, res) {
  try {
    let { full_name, email, username, password } = req.body || {};
    full_name = norm.text(full_name);
    email = norm.email(email);
    username = norm.username(username);
    password = String(password || "");

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "full_name, email et password sont requis." });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Email invalide." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Mot de passe: 8 caractères minimum." });
    }

    // e-mail déjà pris ?
    const dupMail = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1",
      [email]
    );
    if (dupMail.rowCount) {
      return res.status(409).json({ error: "Email déjà utilisé." });
    }

    // username fourni → valider et vérifier collision
    if (username) {
      if (!USERNAME_RE.test(username)) {
        return res.status(400).json({ error: "Identifiant invalide (3–20: a–z, 0–9, . _ -)." });
      }
      const taken = await pool.query(
        "SELECT 1 FROM users WHERE LOWER(username)=LOWER($1) LIMIT 1",
        [username]
      );
      if (taken.rowCount) {
        return res.status(409).json({ error: "Identifiant déjà utilisé." });
      }
    } else {
      // sinon générer depuis full_name ou email
      username = await ensureUniqueUsername(full_name || email.split("@")[0]);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const insert = await pool.query(
      `INSERT INTO users (full_name, email, username, password_hash, role, avatar_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, full_name, email, username, role, avatar_url, created_at`,
      [full_name, email, username, password_hash, "user", null]
    );

    const user = insert.rows[0];
    const token = signToken(user);

    return res.status(201).json({ token, user, message: "Compte créé." });
  } catch (e) {
    console.error("publicRegister:", e);
    // 23505 = violation contrainte UNIQUE (email/username)
    if (e?.code === "23505") {
      return res.status(409).json({ error: "Email ou identifiant déjà pris." });
    }
    return res.status(500).json({ error: "Erreur serveur." });
  }
}

/* ============== Création par un admin (back-office) ============== */
export async function adminCreateUser(req, res) {
  try {
    let { full_name, email, username, password, role = "user", avatar_url = null } = req.body || {};
    full_name = norm.text(full_name);
    email = norm.email(email);
    username = norm.username(username);
    password = String(password || "");
    role = norm.text(role) || "user";

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: "full_name, email, password requis." });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Email invalide." });
    }

    const dupMail = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1",
      [email]
    );
    if (dupMail.rowCount) {
      return res.status(409).json({ message: "Email déjà utilisé." });
    }

    if (username) {
      if (!USERNAME_RE.test(username)) {
        return res.status(400).json({ message: "Identifiant invalide (3–20: a–z, 0–9, . _ -)." });
      }
      const taken = await pool.query(
        "SELECT 1 FROM users WHERE LOWER(username)=LOWER($1) LIMIT 1",
        [username]
      );
      if (taken.rowCount) {
        return res.status(409).json({ message: "Identifiant déjà utilisé." });
      }
    } else {
      username = await ensureUniqueUsername(full_name || email.split("@")[0]);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const insert = await pool.query(
      `INSERT INTO users (full_name, email, username, password_hash, role, avatar_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, full_name, email, username, role, avatar_url, created_at`,
      [full_name, email, username, password_hash, role, avatar_url]
    );

    return res.status(201).json({ message: "Utilisateur créé.", user: insert.rows[0] });
  } catch (e) {
    console.error("adminCreateUser:", e);
    if (e?.code === "23505") {
      return res.status(409).json({ message: "Conflit UNIQUE (email/identifiant)." });
    }
    return res.status(500).json({ message: "Erreur serveur." });
  }
}
