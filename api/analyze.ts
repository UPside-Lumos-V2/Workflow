import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Call 1: 추출 + 정규화 (Phase 1-4)
 * POST /api/analyze
 * Body: { rawText: string, year?: number }
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const { rawText, year, systemInstruction, prompt } = req.body as {
      rawText?: string;
      year?: number;
      systemInstruction: string;
      prompt: string;
    };

    if (!prompt || !systemInstruction) {
      return res.status(400).json({ error: 'systemInstruction and prompt are required' });
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return res.status(geminiRes.status).json({ error: `Gemini API error: ${err}` });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(502).json({ error: 'Empty response from Gemini' });
    }

    return res.status(200).json({ result: JSON.parse(text) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
