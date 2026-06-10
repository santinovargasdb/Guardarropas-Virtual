import type { Prenda } from '../types';

// The actual Gemini call lives in api/chat.ts (Vercel serverless function).
// The API key is kept server-side via process.env.GEMINI_API_KEY — it is
// never embedded in the client bundle.
export const isStylistConfigured = true;

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

const SYSTEM_ROLE =
  'Sos "Luci", la estilista personal de esta app de moda. Hablás en español rioplatense, ' +
  'con mucha onda, divertida, compinche y experta en combinaciones estéticas urbanas. ' +
  'Respuestas CORTAS: máximo 2-3 párrafos. Si recomendás cambiar una prenda, SOLO podés ' +
  'sugerir ropa que exista en el JSON del armario provisto (nunca inventes prendas). Cuando ' +
  'sugieras una pieza concreta del armario, incluí su id exacto entre corchetes con este ' +
  'formato: [PRENDA:id]. No menciones los corchetes ni los ids en tu explicación, usalos sólo ' +
  'como marca técnica al final de la frase correspondiente.';

/**
 * Sends a contextual styling request to the /api/chat serverless endpoint
 * and returns the raw reply text. Throws on network or server errors.
 */
export async function askStylist(
  userMessage: string,
  wardrobe: Prenda[],
  activeOutfit: Record<string, Prenda | undefined>,
  filters: string,
): Promise<string> {
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

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Error del servidor: ${res.status}`);
  }

  const data = await res.json() as { text: string };
  return data.text;
}
