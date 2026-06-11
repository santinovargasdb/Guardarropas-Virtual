import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' });
  }

  const body = req.body as { prompt?: string };
  if (!body?.prompt) {
    return res.status(400).json({ error: 'Falta el campo prompt.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(body.prompt);
    return res.status(200).json({ text: result.response.text() });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error('[Gemini Error]', raw); // surfaced in Vercel function logs
    if (/\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) {
      const m = raw.match(/retry in ([\d.]+)s/i);
      const wait = m ? `~${Math.ceil(Number(m[1]))} segundos` : 'un ratito';
      return res.status(429).json({
        error: `Luci está descansando un momento 😴 Se alcanzó el límite de la API de Gemini. Probá de nuevo en ${wait}.`,
      });
    }
    return res.status(500).json({ error: 'Uy, Luci tuvo un problemita técnico 😅 Probá de nuevo en unos segundos.' });
  }
}
