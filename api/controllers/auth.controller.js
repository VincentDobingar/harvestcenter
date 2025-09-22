import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

export async function register(req, res) {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "full_name, email, password required" });
    }
    const { rows: exists } = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.length) return res.status(409).json({ error: "Email already in use" });

    const hash = await bcrypt.hash(password, 10);
    const role = "student";
    const { rows } = await pool.query(
      `INSERT INTO users(full_name,email,password_hash,role)
       VALUES($1,$2,$3,$4) RETURNING id,full_name,email,role`,
      [full_name, email, hash, role]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "12h" });
    return res.json({ user, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Register failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query("SELECT id,full_name,email,password_hash,role FROM users WHERE email=$1", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "12h" });
    delete user.password_hash;
    return res.json({ user, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
}

export async function me(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.avatar_url,
              p.phone, p.city, p.languages, p.goals, p.bio
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id=$1`,
      [req.user.id]
    );
    return res.json(rows[0] || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load profile" });
  }
}
