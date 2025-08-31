// api/gemini-proxy.js  (Serverless Function en Vercel)
export default async function handler(req, res) {
  // Dominios permitidos (CORS)
  const ALLOWED = [
    "https://nutricris.lat",
    "https://www.nutricris.lat",
    "http://localhost:8888" // para pruebas locales con Netlify dev
  ];
  const origin = req.headers.origin || "";
  const cors = ALLOWED.includes(origin) ? origin : ALLOWED[0];

  res.setHeader("Access-Control-Allow-Origin", cors);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")  return res.status(405).send("Method Not Allowed");

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing API key" });

    // del frontend puedes mandar { prompt } o { payload } (tu payload actual)
    const { model = "gemini-2.5-flash-preview-05-20", payload, prompt } = req.body || {};

    const body =
      payload ||
      {
        contents: [
          { role: "user", parts: [{ text: String(prompt || "").slice(0, 8000) }] },
        ],
      };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({ text, raw: data });
  } catch (e) {
    return res.status(500).json({ error: "Internal error", detail: String(e) });
  }
}
