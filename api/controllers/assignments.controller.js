// 📁 backend/controllers/assignments.controller.js
import { pool } from "../config/db.js";

export async function listAssignments(req, res) {
  try {
    const { course_id } = req.query;
    const { rows } = await pool.query(
      `SELECT id, course_id, lesson_id, title, instructions, due_at, max_score, type
       FROM assignments
       WHERE ($1::int IS NULL OR course_id=$1)
       ORDER BY id DESC`,
      [course_id || null]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
}

export async function createAssignment(req, res) {
  try {
    if (!["trainer","admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { course_id, lesson_id, title, instructions, due_at, max_score = 20, type = "homework" } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO assignments(course_id, lesson_id, title, instructions, due_at, max_score, type, created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [course_id, lesson_id || null, title, instructions || null, due_at || null, max_score, type, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Create failed" });
  }
}

export async function getAssignment(req, res) {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(`SELECT * FROM assignments WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
}

export async function submitAssignment(req, res) {
  try {
    const id = Number(req.params.id);
    const { content_text = null } = req.body;
    const file_url = req.file ? `/uploads/assignments/${req.file.filename}` : null;

    const { rows } = await pool.query(
      `INSERT INTO submissions(assignment_id, user_id, content_text, file_url)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (assignment_id, user_id) DO UPDATE
         SET content_text=EXCLUDED.content_text,
             file_url=COALESCE(EXCLUDED.file_url, submissions.file_url),
             submitted_at=now()
       RETURNING id`,
      [id, req.user.id, content_text, file_url]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Submit failed" });
  }
}

export async function gradeSubmission(req, res) {
  try {
    if (!["trainer","admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = Number(req.params.id); // submission id
    const { grade_score = null, feedback = null } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE submissions SET grade_score=$1, feedback=$2, status='graded' WHERE id=$3`,
      [grade_score, feedback, id]
    );
    if (!rowCount) return res.status(404).json({ error: "Submission not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Grade failed" });
  }
}
