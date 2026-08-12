// Cliente mínimo para la API de Google Gemini (Generative Language API).
// No requiere SDK: usa fetch contra el endpoint REST. Si no hay GEMINI_API_KEY
// configurada, los llamadores deben tratar el caso como "no disponible".

const DEFAULT_MODEL = 'gemini-flash-latest';

export function geminiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function apiUrl() {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const key = process.env.GEMINI_API_KEY;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
}

/**
 * Llama a Gemini con un prompt de texto.
 * @param {string} prompt Texto de entrada para el modelo.
 * @param {object} [options]
 * @param {number} [options.temperature=0.4]
 * @param {object} [options.responseSchema] Esquema JSON para forzar salida estructurada.
 * @param {number} [options.timeout=20000]
 * @returns {Promise<string>} Texto crudo devuelto por el modelo.
 */
export async function generateContent(prompt, options = {}) {
  if (!geminiEnabled()) {
    const err = new Error('Gemini no está configurado: define GEMINI_API_KEY');
    err.status = 503;
    throw err;
  }

  const generationConfig = {
    temperature: options.temperature ?? 0.4,
  };
  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  let res;
  try {
    res = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(options.timeout ?? 20000),
    });
  } catch (e) {
    const err = new Error(
      e.name === 'TimeoutError'
        ? 'Gemini excedió el tiempo de espera'
        : `No fue posible contactar a Gemini: ${e.message}`,
    );
    err.status = 504;
    throw err;
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || '';
    } catch {
      /* ignore */
    }
    const err = new Error(`Gemini respondió ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text.trim()) {
    const err = new Error('Gemini devolvió una respuesta vacía');
    err.status = 502;
    throw err;
  }
  return text.trim();
}

/**
 * Llama a Gemini forzando salida JSON según un esquema y la parsea.
 * @returns {Promise<object>}
 */
export async function generateJson(prompt, responseSchema, options = {}) {
  const raw = await generateContent(prompt, { ...options, responseSchema });
  try {
    return JSON.parse(raw);
  } catch {
    // Como salvaguarda, intenta extraer el primer bloque JSON del texto.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    const err = new Error('Gemini no devolvió un JSON válido');
    err.status = 502;
    throw err;
  }
}
