const PROXY_URL = "https://nutricris-ai-proxy.vercel.app/api/gemini-proxy";

// Helper reutilizable (igual filosofía que en tus calculadoras)
async function askGemini(prompt) {
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 350, temperature: 0.7, topP: 0.95, topK: 40 },
  };

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });

  // Intenta parsear JSON siempre
  let data = {};
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    const msg = data?.error?.error?.message || data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Extrae texto con fallback al RAW
  const text =
    (data?.text || (data?.raw?.candidates?.[0]?.content?.parts || [])
      .map(p => (typeof p?.text === "string" ? p.text : ""))
      .join("\n")).trim();

  if (!text) {
    throw new Error(data?.note || "Respuesta vacía del modelo");
  }

  console.debug("Gemini result:", data); // <-- útil en Network/Console
  return text;
}

const handleSendMessage = async () => {
  const userMessage = userInput.value;
  if (!userMessage || !userMessage.trim()) return;

  appendMessage(userMessage.trim(), "user");
  userInput.value = "";
  autoResize(userInput);
  appendTyping();

  const prompt = `Eres un asistente de nutrición amable y profesional para el sitio de Nut. Cristian.
Responde en español neutro.
REGLAS:
- No des diagnósticos médicos ni prescribas tratamientos.
- Si la pregunta no es de nutrición/bienestar, dilo amablemente.
- Extensión: 4–7 frases (≈80–150 palabras). Si ayuda, agrega una lista breve (máx. 5 puntos).
- Cierra con una “siguiente acción” simple (p.ej., beber agua, revisar etiquetas o agendar consulta).

Pregunta del usuario: "${userMessage}"`;

  try {
    const reply = await askGemini(prompt);
    removeTyping();
    appendMessage(reply, "ai");
  } catch (err) {
    console.error("AI error:", err);
    removeTyping();
    appendMessage("Lo siento, hubo un problema. Intenta de nuevo.", "ai");
  }
};




