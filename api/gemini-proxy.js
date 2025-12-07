// api/gemini-proxy.js
export default async function handler(req, res) {
  // --- CORS ---
  const ALLOWED = ["https://nutricris.lat", "https://www.nutricris.lat"];
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED.includes(origin) ? origin : "https://nutricris.lat");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET: healthcheck + confirma si el runtime ve la key
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Gemini proxy up",
      hasKey: !!process.env.GEMINI_API_KEY,
      env: process.env.VERCEL_ENV || "unknown",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --- Lee body JSON de forma segura ---
  let bodyText = "";
  try { for await (const chunk of req) bodyText += chunk; } catch {}
  let body = {};
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}

  try {
    const { payload } = body || {};
    if (!payload) return res.status(400).json({ error: "Missing payload" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-pro:generateContent?key=${apiKey}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("Gemini upstream error:", data);
      return res.status(upstream.status).json({ error: data, where: "upstream" });
    }

    // --- EXTRAER TEXTO DE FORMA RESILIENTE ---
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map(p => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    // Si no hubo texto, devolvemos una nota útil
    const note = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "empty_text";
    if (!text) {
      return res.status(200).json({ text: "", raw: data, note });
    }

    return res.status(200).json({ text, raw: data });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failure" });
  }
}




