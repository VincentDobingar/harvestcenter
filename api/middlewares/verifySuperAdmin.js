// 📁 /middlewares/verifySuperAdmin.js
export default function verifySuperAdmin(req, res, next) {
  if (req.admin?.role !== "superAdmin") {
    return res.status(403).json({ message: "Accès réservé au superAdmin." });
  }
  next();
}
