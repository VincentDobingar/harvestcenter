// 📁 backend/middlewares/verifyUserToken.js
// Middleware pour vérifier un token utilisateur (Bearer JWT)
// Exporte à la fois un export nommé et un default pour compatibilité.

import jwt from "jsonwebtoken";

export async function verifyUserToken(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const secret = process.env.JWT_SECRET || "dev-secret";
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (e) {
      console.error("verifyUserToken: JWT verify failed:", e && (e.message || e));
      return res.status(401).json({ error: "Token invalide" });
    }

    // Attache l'utilisateur décodé à la requête (id, role, etc.)
    req.user = {
      id: payload.sub || payload.id || null,
      role: payload.role || null,
      raw: payload,
    };

    return next();
  } catch (err) {
    console.error("verifyUserToken error:", err && (err.stack || err.message || err));
    return res.status(500).json({ error: "Erreur serveur (auth)" });
  }
}

// Export default pour les imports en "import verifyUserToken from '...'"
export default verifyUserToken;
