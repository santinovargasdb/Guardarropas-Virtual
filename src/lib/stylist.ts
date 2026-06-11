import type { Prenda } from '../types';

// The Groq key now lives server-side (GROQ_API_KEY in Vercel), so the client can't
// probe it. The chat is on by default; set VITE_STYLIST_ENABLED=false to hide it.
export const isStylistConfigured = import.meta.env.VITE_STYLIST_ENABLED !== 'false';

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
 * Sends a contextual styling request to the /api/chat serverless function, which
 * forwards it to Groq with the GROQ_API_KEY that stays server-side. Builds the full
 * prompt (role + wardrobe + active outfit) and returns the model's raw reply.
 * Throws a friendly, self-contained message on any error (shown by the chat UI).
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

  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch (err) {
    console.error('[Stylist Error]', err); // keep the raw error in DevTools
    throw new Error('No pude conectarme con Luci 😅 Revisá tu conexión y probá de nuevo.');
  }

  // The serverless function already returns friendly { error } messages on failure.
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Uy, Luci tuvo un problemita técnico 😅 Probá de nuevo en unos segundos.');
  }
  return data.text ?? '';
}
