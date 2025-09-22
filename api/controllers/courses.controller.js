import { pool } from "../config/db.js";

export async function listCourses(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, slug, description, cover_url, category, level FROM courses ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
}

export async function getCourseBySlug(req, res) {
  try {
    const { slug } = req.params;
    const { rows } = await pool.query(`SELECT * FROM courses WHERE slug=$1`, [slug]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const course = rows[0];
    const { rows: modules } = await pool.query(
      `SELECT id, title, sort_order FROM course_modules WHERE course_id=$1 ORDER BY sort_order ASC`,
      [course.id]
    );
    for (const m of modules) {
      const { rows: lessons } = await pool.query(
        `SELECT id, title, duration_min, sort_order FROM lessons WHERE module_id=$1 ORDER BY sort_order ASC`,
        [m.id]
      );
      m.lessons = lessons;
    }
    course.modules = modules;
    res.json(course);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
}

export async function createCourse(req, res) {
  try {
    const { title, slug, description, cover_url, category, level } = req.body;
    if (!["trainer","admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { rows } = await pool.query(
      `INSERT INTO courses(title,slug,description,cover_url,category,level,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, slug`,
      [title, slug, description || null, cover_url || null, category || null, level || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Create failed" });
  }
}
