// 📁 ~/harvestcentertd.org/api/controllers/progress.controller.js
// Contrôleur simple pour le suivi de progression des cours
// NOTE: adapte les noms de tables/colonnes à ta base si besoin.

import { pool } from "../config/db.js";

/**
 * toggleLesson(user, { course_id, lesson_id })
 * - marque la leçon comme complétée pour l'utilisateur si non faite,
 *   ou la supprime si déjà complétée (toggle).
 * - retourne l'objet de progression mis à jour / résumé.
 *
 * On suppose une table `course_progress` (ou adapt) avec au minimum :
 *  - id, user_id, course_id, lesson_id, completed_at (timestamp)
 */
export async function toggleLesson(user, { course_id, lesson_id }) {
  if (!user || !user.id) throw Object.assign(new Error("Utilisateur non authentifié."), { status: 401 });
  if (!course_id || !lesson_id) throw Object.assign(new Error("course_id et lesson_id requis."), { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) vérifier si la ligne existe (déjà complétée)
    const check = await client.query(
      `SELECT id FROM course_progress WHERE user_id=$1 AND course_id=$2 AND lesson_id=$3 LIMIT 1`,
      [user.id, course_id, lesson_id]
    );

    let action = "created";
    if (check.rows.length) {
      // déjà complété -> suppression (toggle off)
      await client.query(
        `DELETE FROM course_progress WHERE id=$1`,
        [check.rows[0].id]
      );
      action = "removed";
    } else {
      // insérer
      await client.query(
        `INSERT INTO course_progress (user_id, course_id, lesson_id, completed_at)
         VALUES ($1,$2,$3,NOW())`,
        [user.id, course_id, lesson_id]
      );
      action = "created";
    }

    // 2) calculer le progrès résumé pour cet utilisateur & cours
    const [{ rows: [progressSummary] = [] } = {}] = await Promise.all([
      client.query(
        `SELECT
           COUNT(*) FILTER (WHERE cp.user_id=$1 AND c.id IS NOT NULL) AS completed_lessons,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = $2) AS total_lessons
         FROM course_progress cp
         JOIN lessons c ON c.id = cp.lesson_id
         WHERE cp.user_id = $1 AND cp.course_id = $2`,
        [user.id, course_id]
      )
    ]).then(r => r);

    // si la requête ci-dessus ne retourne rien (par ex. pas de jointure lessons), fallback :
    let completed_lessons = 0;
    let total_lessons = 0;
    if (progressSummary) {
      completed_lessons = Number(progressSummary.completed_lessons || 0);
      total_lessons = Number(progressSummary.total_lessons || 0);
    } else {
      // fallback simple : compter dans course_progress et dans lessons (si table présente)
      const c1 = await client.query(`SELECT COUNT(*) AS cnt FROM course_progress WHERE user_id=$1 AND course_id=$2`, [user.id, course_id]);
      const c2 = await client.query(`SELECT COUNT(*) AS cnt FROM lessons WHERE course_id=$1`, [course_id]);
      completed_lessons = Number(c1.rows[0]?.cnt || 0);
      total_lessons = Number(c2.rows[0]?.cnt || 0);
    }

    await client.query("COMMIT");

    const percent = total_lessons > 0 ? Math.round((completed_lessons / total_lessons) * 100) : 0;
    return { action, completed_lessons, total_lessons, percent };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("toggleLesson error:", e);
    // propagate a structured error
    throw Object.assign(new Error(e.message || "Erreur toggleLesson"), { status: e.status || 500 });
  } finally {
    client.release();
  }
}

/**
 * courseProgressForMe(user, courseId)
 * - renvoie le détail du progrès de l'utilisateur pour un cours
 * - format retourné : { completed_lessons: number, total_lessons: number, percent, completed_lesson_ids: [..] }
 */
export async function courseProgressForMe(user, courseId) {
  if (!user || !user.id) throw Object.assign(new Error("Utilisateur non authentifié."), { status: 401 });
  if (!courseId) throw Object.assign(new Error("courseId requis."), { status: 400 });

  try {
    const [completedRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT lesson_id FROM course_progress WHERE user_id=$1 AND course_id=$2`,
        [user.id, courseId]
      ),
      pool.query(
        `SELECT id FROM lessons WHERE course_id=$1 ORDER BY id`,
        [courseId]
      )
    ]);

    const completed_lesson_ids = completedRes.rows.map(r => r.lesson_id);
    const total_lessons = totalRes.rows.length;
    const completed_lessons = completed_lesson_ids.length;
    const percent = total_lessons > 0 ? Math.round((completed_lessons / total_lessons) * 100) : 0;

    return { completed_lessons, total_lessons, percent, completed_lesson_ids };
  } catch (e) {
    console.error("courseProgressForMe error:", e);
    throw Object.assign(new Error(e.message || "Erreur courseProgressForMe"), { status: 500 });
  }
}

/**
 * listCourseProgress(courseId)
 * - admin usage: liste les progressions de tous les utilisateurs pour un cours
 * - retourne un tableau d'objets { user_id, lesson_id, completed_at }
 */
export async function listCourseProgress(courseId) {
  if (!courseId) throw Object.assign(new Error("courseId requis"), { status: 400 });

  try {
    const { rows } = await pool.query(
      `SELECT user_id, lesson_id, completed_at
       FROM course_progress
       WHERE course_id = $1
       ORDER BY completed_at DESC`,
      [courseId]
    );
    return rows;
  } catch (e) {
    console.error("listCourseProgress error:", e);
    throw Object.assign(new Error(e.message || "Erreur listCourseProgress"), { status: 500 });
  }
}

export default {
  toggleLesson,
  courseProgressForMe,
  listCourseProgress,
};
