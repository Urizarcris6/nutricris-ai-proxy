// api/gemini-proxy.js
export default async function handler(req, res) {
  // --- CORS (solo tu dominio) ---
  const ALLOWED = ["https://nutricris.lat", "https://www.nutricris.lat"];
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED.includes(origin) ? origin : "https://nutricris.lat");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET: health check + diagnostico de variables
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

  // --- Lee y parsea el body JSON con tolerancia ---
  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  try {
    const { payload } = body || {};
    if (!payload) return res.status(400).json({ error: "Missing payload" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=" + apiKey;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json();

    // Si Google responde error HTTP, lo pasamos tal cual con el cuerpo para depurar
    if (!upstream.ok) {
      console.error("Gemini upstream error:", data);
      return res.status(upstream.status).json({ error: data });
    }

    // Si el prompt fue bloqueado por seguridad/safety
    const blocked = data?.promptFeedback?.blockReason;
    if (blocked) {
      return res.status(200).json({
        text: "Lo siento, no puedo responder ese contenido. ¿Puedes reformular la pregunta de forma más general o educativa?",
        raw: data,
      });
    }

    // Extraer texto de TODAS las partes posibles
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const pieces = [];
    for (const p of parts) {
      if (typeof p?.text === "string") pieces.push(p.text);
      // (si algún día viniera otro tipo, puedes mapearlo aquí)
    }
    const textOut = pieces.join("\n\n").trim();

    return res.status(200).json({ text: textOut, raw: data });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failure" });
  }
}




