import { pool } from "../config/db.js";

export async function myEnrollments(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, c.id as course_id, c.title, c.slug, e.status,
              COALESCE((
                SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE lp.status='done') / NULLIF(COUNT(*),0), 1)
                FROM lessons l
                LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id
                  AND lp.enrollment_id=e.id
                WHERE l.module_id IN (SELECT id FROM course_modules WHERE course_id=c.id)
              ), 0) AS progress_percent
       FROM enrollments e
       JOIN courses c ON c.id=e.course_id
       WHERE e.user_id=$1
       ORDER BY e.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
}

export async function enroll(req, res) {
  try {
    const { course_id } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO enrollments(user_id,course_id)
       VALUES($1,$2) ON CONFLICT (user_id,course_id) DO NOTHING
       RETURNING id`,
      [req.user.id, course_id]
    );
    res.status(201).json(rows[0] || { message: "Already enrolled" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Enroll failed" });
  }
}
