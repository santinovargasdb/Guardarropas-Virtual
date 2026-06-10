import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Prenda } from '../types';

// ── Gemini setup ──────────────────────────────────────────────────────────────
// NOTE: VITE_ vars are embedded in the client bundle, so this key is visible to
// anyone who opens the deployed site. For production, prefer a serverless proxy
// that keeps the key server-side. Configure VITE_GEMINI_API_KEY in .env.local
// (git-ignored) for local dev and in the Vercel dashboard for deploys.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

export const isStylistConfigured = Boolean(model);

export interface ChatMessage {
  role: 'user' | 'stylist';
  text: string;
}

// Summarised wardrobe entry sent to the model as JSON context.
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
 * Throws when the model isn't configured or the request fails.
 */
export async function askStylist(
  userMessage: string,
  wardrobe: Prenda[],
  activeOutfit: Record<string, Prenda | undefined>,
  filters: string,
): Promise<string> {
  if (!model) {
    throw new Error('El estilista no está configurado: falta VITE_GEMINI_API_KEY.');
  }

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

  const result = await model.generateContent(prompt);
  return result.response.text();
}
