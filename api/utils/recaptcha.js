// 📁 utils/recaptcha.js

import fetch from "node-fetch";

/**
 * Vérifie un token reCAPTCHA v3 côté serveur
 * @param {string} token - token renvoyé par grecaptcha.execute()
 * @param {string} remoteip - req.ip (optionnel)
 * @param {string} action - action attendue (optionnel)
 * @returns {Promise<{ok:boolean, score:number, action?:string, error?:string}>}
 */
export async function verifyRecaptcha(token, remoteip, action) {
  try {
    if (!process.env.RECAPTCHA_SECRET) {
      // si pas de clé, on accepte (pour dev)
      return { ok: true, score: 1.0, action: "disabled" };
    }
    const params = new URLSearchParams();
    params.append("secret", process.env.RECAPTCHA_SECRET);
    params.append("response", token || "");
    if (remoteip) params.append("remoteip", remoteip);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body: params
    });
    const data = await res.json();

    const min = Number(process.env.RECAPTCHA_MIN_SCORE || 0.4);
    const ok = !!(data.success && (data.score ?? 1) >= min);
    if (action && data.action && data.action !== action) {
      return { ok: false, score: data.score ?? 0, action: data.action, error: "Action mismatch" };
    }
    return { ok, score: data.score ?? 0, action: data.action };
  } catch (e) {
    return { ok: false, score: 0, error: e?.message || "recaptcha error" };
  }
}
