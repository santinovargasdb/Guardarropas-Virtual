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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(body.prompt);
    return res.status(200).json({ text: result.response.text() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al consultar Gemini';
    return res.status(500).json({ error: msg });
  }
}
