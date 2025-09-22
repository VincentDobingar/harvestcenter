// 📁 controllers/messages.controller.js
import { pool } from "../config/db.js";

export const getAllMessages = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM messages_contact ORDER BY date_envoi DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur récupération des messages:", err);
    res.status(500).json({ error: "Erreur récupération des messages." });
  }
};

// ✅ Marquer un message comme lu/non lu
export const updateLuStatus = async (req, res) => {
  const { id } = req.params;
  const { lu } = req.body;
  try {
    await pool.query("UPDATE messages_contact SET lu = $1 WHERE id = $2", [lu, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur mise à jour état lu :", err);
    res.status(500).json({ error: "Erreur mise à jour." });
  }
};

