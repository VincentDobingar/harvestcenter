// 📁 backend/middlewares/verifyAdminToken.js
import jwt from "jsonwebtoken";

/**
 * Middleware qui vérifie la présence d'un token Bearer JWT et le décode.
 * - attache req.user = { id, role, raw }
 * - renvoie 401 si pas de token ou token invalide
 * - (optionnel) renvoie 403 si role != 'admin' — décommente la ligne correspondante si tu veux restreindre
 */
export async function verifyAdminToken(req, res, next) {
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
    } catch (err) {
      console.error("verifyAdminToken: JWT verify failed:", err && (err.message || err));
      return res.status(401).json({ error: "Token invalide" });
    }

    // Attache le user décodé
    req.user = {
      id: payload.sub || payload.id || null,
      role: payload.role || null,
      raw: payload,
    };

    // Si tu veux restreindre l'accès aux admins uniquement, décommente:
    // if (req.user.role !== 'admin') return res.status(403).json({ error: "Accès refusé (admin requis)" });

    return next();
  } catch (err) {
    console.error("verifyAdminToken error:", err && (err.stack || err.message || err));
    return res.status(500).json({ error: "Erreur serveur (auth)" });
  }
}

// export default pour compatibilité avec les imports "import verifyAdminToken from '...'"
export default verifyAdminToken;
