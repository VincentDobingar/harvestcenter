import { pool } from "../config/db.js";

export async function getMyProfile(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, phone, city, languages, goals, bio FROM profiles WHERE user_id=$1`,
      [req.user.id]
    );
    return res.json(rows[0] || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
}

export async function upsertMyProfile(req, res) {
  try {
    const { phone, city, languages = [], goals, bio } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO profiles(user_id,phone,city,languages,goals,bio)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE
         SET phone=EXCLUDED.phone, city=EXCLUDED.city, languages=EXCLUDED.languages,
             goals=EXCLUDED.goals, bio=EXCLUDED.bio
       RETURNING user_id, phone, city, languages, goals, bio`,
      [req.user.id, phone || null, city || null, languages, goals || null, bio || null]
    );
    return res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save profile" });
  }
}
