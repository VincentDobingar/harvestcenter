// 📁 backend/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

import { pool } from "./config/db.js";

// Middlewares d'auth
import { verifyAdminToken } from "./middlewares/verifyAdminToken.js";

// Routes existantes (publiques)
import contactRoutes from "./routes/contact.js";
import messagesRoutes from "./routes/messages.js";
import inscriptionRoutes from "./routes/inscription.js";

// ✅ Routes Admin
import adminRoutes from "./routes/admin.js";

// ✅ Upload & Media
import uploadsRoutes from "./routes/uploads.js";
import mediaRoutes from "./routes/media.js";
import uploadsS3Routes from "./routes/uploads-s3.js";

// Auth, profils, etc.
import authRoutes from "./routes/auth.js";
import profilesRoutes from "./routes/profiles.js";
import coursesRoutes from "./routes/courses.js";
import enrollmentsRoutes from "./routes/enrollments.js";
import progressRoutes from "./routes/progress.js";
import assignmentsRoutes from "./routes/assignments.js";
import usersRoutes from "./routes/users.routes.js";

dotenv.config();
const app = express();

/* -------------------------------------------------------
   Base API (aligne front et back : /api recommandé)
------------------------------------------------------- */
const API_BASE = process.env.API_BASE ?? "/api";

/* -------------------------------------------------------
   __dirname & static uploads
------------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = "uploads";
const absUploads = path.resolve(__dirname, uploadDir);
fs.mkdirSync(absUploads, { recursive: true });

// Servez les fichiers uploadés sous la même base API
app.use(`${API_BASE}/uploads`, express.static(absUploads));

/* -------------------------------------------------------
   CORS solide (origines autorisées + préflight)
------------------------------------------------------- */
const defaultAllowed = [
  "https://www.harvestcentertd.org",
  "https://harvestcentertd.org",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(s => s.trim()).filter(Boolean)
  : defaultAllowed
);

// Helper: vérifie l’origine et reflète si autorisée
const corsOptions = {
  origin(origin, cb) {
    // Autorise aussi les requêtes sans header Origin (curl/healthcheck)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204, // pour anciens navigateurs
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ⬅️ indispensable pour le préflight

// Varie sur l'origine (meilleur cache CDN)
app.use((_req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

/* -------------------------------------------------------
   Body & cookies
------------------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* -------------------------------------------------------
   Health/Ping
------------------------------------------------------- */
app.get(`${API_BASE}/ping`, (_req, res) => {
  res.json({ message: "🔁 Backend Harvest Center opérationnel" });
});

/* -------------------------------------------------------
   Upload/Media
------------------------------------------------------- */
app.use(`${API_BASE}/uploads`, verifyAdminToken, uploadsRoutes);
app.use(`${API_BASE}/uploads/s3`, verifyAdminToken, uploadsS3Routes);
app.use(`${API_BASE}/media`, mediaRoutes);


// DEBUG — ajouter temporairement (retire après débogage)
app.get(`${API_BASE}/__debug`, async (req, res) => {
  try {
    // info d'env
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      API_BASE: process.env.API_BASE,
      JWT: !!process.env.JWT_SECRET,
      PG: !!process.env.DATABASE_URL,
      ORIGINS: process.env.CORS_ORIGINS,
    };

    // test connexion postgres
    let pgNow = null;
    try {
      const { rows } = await pool.query("SELECT NOW()");
      pgNow = rows[0];
    } catch (pgErr) {
      pgNow = { error: String(pgErr.message || pgErr) };
    }

    // count users (sécurisé)
    let usersCount = null;
    try {
      const { rows } = await pool.query("SELECT count(*) AS c FROM users");
      usersCount = rows[0].c;
    } catch (e) {
      usersCount = `ERR: ${String(e.message || e)}`;
    }

    return res.json({ ok: true, env, pgNow, usersCount });
  } catch (err) {
    console.error("__debug error:", err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

/* -------------------------------------------------------
   Public
------------------------------------------------------- */
app.use(`${API_BASE}/contact`, contactRoutes);
app.use(`${API_BASE}/messages`, messagesRoutes);
app.use(`${API_BASE}/inscription`, inscriptionRoutes);

// Compat users (ex: /users/register)
app.use(`${API_BASE}/users`, usersRoutes);

/* -------------------------------------------------------
   Admin
------------------------------------------------------- */
app.use(`${API_BASE}/admin`, adminRoutes);

/* -------------------------------------------------------
   Autres modules
------------------------------------------------------- */
app.use(`${API_BASE}/auth`, authRoutes);
app.use(`${API_BASE}/profiles`, profilesRoutes);
app.use(`${API_BASE}/courses`, coursesRoutes);
app.use(`${API_BASE}/enrollments`, enrollmentsRoutes);
app.use(`${API_BASE}/progress`, progressRoutes);
app.use(`${API_BASE}/assignments`, assignmentsRoutes);

/* -------------------------------------------------------
   Test PostgreSQL
------------------------------------------------------- */
try {
  const result = await pool.query("SELECT NOW()");
  console.log("✅ PostgreSQL connecté :", result.rows[0]);
} catch (err) {
  console.error("❌ Connexion PostgreSQL échouée:", err.message);
}

/* -------------------------------------------------------
   404 API & errors
------------------------------------------------------- */
app.use((req, res, next) => {
  if (API_BASE && req.path.startsWith(API_BASE)) {
    return res.status(404).json({ message: "Route API introuvable." });
  }
  next();
});

app.use((err, _req, res, _next) => {
  console.error("💥 Erreur API:", err);
  res.status(err.status || 500).json({ message: err.message || "Erreur serveur." });
});

/* -------------------------------------------------------
   Lancement serveur
------------------------------------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT} (API_BASE=${API_BASE})`);
  console.log(`🌐 CORS autorisé pour :`, allowedOrigins);
});
