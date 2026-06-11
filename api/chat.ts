import type { VercelRequest, VercelResponse } from '@vercel/node';

// Luci runs on Groq's free tier (OpenAI-compatible API). The key lives ONLY here,
// server-side — it is never shipped to the browser bundle.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // production model on Groq's free plan

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY no está configurada en el servidor.' });
  }

  const body = req.body as { prompt?: string };
  if (!body?.prompt) {
    return res.status(400).json({ error: 'Falta el campo prompt.' });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.8,
        messages: [{ role: 'user', content: body.prompt }],
      }),
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text();
      console.error('[Groq Error]', groqRes.status, detail); // visible in Vercel function logs
      if (groqRes.status === 429) {
        const retry = groqRes.headers.get('retry-after');
        const wait = retry ? `~${Math.ceil(Number(retry))} segundos` : 'un ratito';
        return res.status(429).json({
          error: `Luci está descansando un momento 😴 Se alcanzó el límite de la API. Probá de nuevo en ${wait}.`,
        });
      }
      return res.status(502).json({ error: 'Uy, Luci tuvo un problemita técnico 😅 Probá de nuevo en unos segundos.' });
    }

    const data = (await groqRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ text });
  } catch (err) {
    console.error('[Groq Error]', err);
    return res.status(500).json({ error: 'Uy, Luci tuvo un problemita técnico 😅 Probá de nuevo en unos segundos.' });
  }
}
