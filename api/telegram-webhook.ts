import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_API = 'https://api.telegram.org';

// 팀원 목록 (하드코딩 — Dexie 로컬 DB는 서버에서 접근 불가)
const MEMBERS = [
  'Erwin', 'Ethan', 'Omin', 'Tamaneko',
  'Wi11y', 'Wiimdy', 'Yham', 'Zeroluck',
];

async function tgSend(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    const update = req.body;

    // ── 1) 텍스트 커맨드 처리 ──
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text === '/lumos_status' || text.startsWith('/lumos_status@')) {
        // 팀원 선택 inline keyboard (2열 배치)
        const keyboard: { text: string; callback_data: string }[][] = [];
        for (let i = 0; i < MEMBERS.length; i += 2) {
          const row: { text: string; callback_data: string }[] = [
            { text: MEMBERS[i], callback_data: `status:${MEMBERS[i]}` },
          ];
          if (MEMBERS[i + 1]) {
            row.push({ text: MEMBERS[i + 1], callback_data: `status:${MEMBERS[i + 1]}` });
          }
          keyboard.push(row);
        }

        await tgSend(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '📊 *팀원을 선택하세요:*',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      if (text === '/lumos_cases' || text.startsWith('/lumos_cases@')) {
        await tgSend(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '🔍 *Active 케이스 확인:*\n[LUMOS Workflow에서 확인](https://lumos-workflow.vercel.app/app/cases)',
          parse_mode: 'Markdown',
        });
      }

      if (text === '/lumos_weekly' || text.startsWith('/lumos_weekly@')) {
        await tgSend(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '📋 *이번 주 보드:*\n[LUMOS Workflow에서 확인](https://lumos-workflow.vercel.app/app/weekly)',
          parse_mode: 'Markdown',
        });
      }
    }

    // ── 2) Callback query 처리 (inline keyboard 응답) ──
    if (update.callback_query) {
      const callbackId = update.callback_query.id;
      const data = update.callback_query.data as string;
      const chatId = update.callback_query.message?.chat.id;

      // answerCallbackQuery (버튼 로딩 해제)
      await tgSend(botToken, 'answerCallbackQuery', {
        callback_query_id: callbackId,
      });

      if (data.startsWith('status:') && chatId) {
        const memberName = data.split(':')[1];
        // 현재 DB가 클라이언트 로컬이므로 웹 링크로 안내
        await tgSend(botToken, 'sendMessage', {
          chat_id: chatId,
          text: `👤 *${memberName}* 현황:\n[워크플로우에서 확인](https://lumos-workflow.vercel.app/app/weekly)`,
          parse_mode: 'Markdown',
        });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[telegram-webhook] Error:', err);
    return res.status(200).json({ ok: true }); // Telegram은 항상 200 반환해야 재시도 안 함
  }
}
