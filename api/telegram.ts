import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_API = 'https://api.telegram.org';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured' });
  }

  try {
    const { text, parse_mode } = req.body as { text: string; parse_mode?: string };
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const tgRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parse_mode || 'Markdown',
      }),
    });

    if (!tgRes.ok) {
      const err = await tgRes.text();
      return res.status(tgRes.status).json({ error: `Telegram API error: ${err}` });
    }

    const data = await tgRes.json();
    return res.status(200).json({ ok: true, message_id: data.result?.message_id });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
