// api/gemini-proxy.js
export default async function handler(req, res) {
  // --- CORS ---
  const ALLOWED = [
    "https://nutricris.lat",
    "https://www.nutricris.lat",
  ];
  const origin = req.headers.origin || "";
  res.setHeader(
    "Access-Control-Allow-Origin",
    ALLOWED.includes(origin) ? origin : "https://nutricris.lat"
  );
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // --- GET: health check (para probar en el navegador) ---
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

  // --- Lee y parsea el body JSON (soporta streaming) ---
  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    body = raw ? JSON.parse(raw) : {};
  } catch {
    // si falla el parseo, body queda {}
  }

  try {
    const { payload } = body || {};
    if (!payload) return res.status(400).json({ error: "Missing payload" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=" +
      apiKey;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("Gemini upstream error:", data);
      return res.status(upstream.status).json({ error: data });
    }

    // --- Extrae texto uniendo todas las parts y con fallbacks ---
    function extractText(g) {
      try {
        const candidates = g?.candidates || [];
        for (const c of candidates) {
          const parts = c?.content?.parts || [];
          const joined = parts
            .map(p => (typeof p?.text === "string" ? p.text : ""))
            .join("")
            .trim();
          if (joined) return joined;
        }
        return g?.output_text || g?.text || "";
      } catch {
        return "";
      }
    }

    const text = extractText(data);
    if (!text) {
      console.error(
        "Gemini: respuesta sin texto. Dump corto:",
        JSON.stringify(data).slice(0, 500)
      );
    }

    return res.status(200).json({ text, raw: data });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy failure" });
  }
}



