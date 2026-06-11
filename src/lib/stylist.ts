import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Prenda } from '../types';

// isStylistConfigured: evaluated at module load — tells the UI whether to show
// the chat panel. VITE_ vars are statically replaced by Vite at build time.
export const isStylistConfigured = Boolean(import.meta.env.VITE_GEMINI_API_KEY);

export interface ChatMessage {
  role: 'user' | 'stylist';
  text: string;
}

function summarizePrenda(p: Prenda) {
  return {
    id: p.id,
    nombre: p.notas_ia ?? p.category,
    category: p.category,
    climate: p.clima,
    color_primary: p.primary_colors ?? p.colors,
    color_secondary: p.secondary_colors ?? [],
    styles: p.styles,
  };
}

function describeOutfit(outfit: Record<string, Prenda | undefined>): string {
  const lines: string[] = [];
  for (const [slot, item] of Object.entries(outfit)) {
    if (!item) continue;
    const colors = [...(item.primary_colors ?? []), ...(item.secondary_colors ?? [])].join(', ') || 'n/d';
    lines.push(`- ${slot}: "${item.notas_ia ?? item.category}" (id: ${item.id}, colores: ${colors})`);
  }
  return lines.length ? lines.join('\n') : 'El maniquí está vacío todavía.';
}

/**
 * Maps a raw Gemini SDK error to a friendly, self-contained message for the UI.
 * 429s (free-tier quota / rate limit) are the common case, so we soften them and
 * surface the retry hint Google sends back when present.
 */
function friendlyGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) {
    const m = raw.match(/retry in ([\d.]+)s/i);
    const wait = m ? `~${Math.ceil(Number(m[1]))} segundos` : 'un ratito';
    return `Luci está descansando un momento 😴 Se alcanzó el límite de la API de Gemini. Probá de nuevo en ${wait}.`;
  }
  return 'Uy, Luci tuvo un problemita técnico 😅 Probá de nuevo en unos segundos.';
}

const SYSTEM_ROLE =
  'Sos "Luci", la estilista personal de esta app de moda. Hablás en español rioplatense, ' +
  'con mucha onda, divertida, compinche y experta en combinaciones estéticas urbanas. ' +
  'Respuestas CORTAS: máximo 2-3 párrafos. Si recomendás cambiar una prenda, SOLO podés ' +
  'sugerir ropa que exista en el JSON del armario provisto (nunca inventes prendas). Cuando ' +
  'sugieras una pieza concreta del armario, incluí su id exacto entre corchetes con este ' +
  'formato: [PRENDA:id]. No menciones los corchetes ni los ids en tu explicación, usalos sólo ' +
  'como marca técnica al final de la frase correspondiente.';

/**
 * Sends a contextual styling request to Gemini and returns the raw reply.
 * The SDK is instantiated dynamically on each call so the env var is read
 * fresh — useful when diagnosing whether Vite injected it at build time.
 * Throws on missing key or API errors (caught and displayed by StylistChat).
 */
export async function askStylist(
  userMessage: string,
  wardrobe: Prenda[],
  activeOutfit: Record<string, Prenda | undefined>,
  filters: string,
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Diagnostic: logs TRUE if Vite injected the key, FALSE if not.
  // Check Chrome DevTools → Console after a send to audit production.
  console.log('[Gemini Link]', !!apiKey);

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY no está disponible en este build. Configurala en Vercel → Settings → Environment Variables y redesplegá.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = [
    SYSTEM_ROLE,
    '',
    '=== FILTROS ACTIVOS ===',
    filters,
    '',
    '=== ARMARIO DE LUCI (JSON) ===',
    JSON.stringify(wardrobe.map(summarizePrenda)),
    '',
    '=== OUTFIT ACTIVO EN EL MANIQUÍ ===',
    describeOutfit(activeOutfit),
    '',
    '=== MENSAJE DE LUCI ===',
    userMessage,
  ].join('\n');

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini Error]', err); // keep the raw error in DevTools for debugging
    throw new Error(friendlyGeminiError(err));
  }
}
