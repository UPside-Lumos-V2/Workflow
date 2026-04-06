import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_API = 'https://api.telegram.org';

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

interface CachedData {
  members?: Record<string, { total: number; done: number; tasks: string[] }>;
  goals?: string[];
  cases?: { title: string; priority: string; protocol: string; chain: string }[];
}

/** Supabase REST API에서 캐시된 데이터 가져오기 */
async function getCachedData(): Promise<CachedData | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/bot_weekly_cache?id=eq.current&select=data`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (rows.length === 0) return null;
    return rows[0].data;
  } catch {
    return null;
  }
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
        // 취소 버튼 추가
        keyboard.push([{ text: '❌ 닫기', callback_data: 'cancel' }]);

        await tgSend(botToken, 'sendMessage', {
          chat_id: chatId,
          text: '📊 *팀원을 선택하세요:*',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      if (text === '/lumos_cases' || text.startsWith('/lumos_cases@')) {
        const cached = await getCachedData();
        if (cached?.cases && cached.cases.length > 0) {
          const caseList = cached.cases.map((c, i) => {
            const priority = c.priority === 'high' ? '🔴' : c.priority === 'medium' ? '🟡' : '🟢';
            return `${i + 1}. ${priority} *${c.title}*\n    ${c.protocol || '-'} | ${c.chain || '-'}`;
          }).join('\n');
          await tgSend(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `🔍 *Active 케이스 (${cached.cases.length}개):*\n\n${caseList}\n\n[상세 보기](https://lumos-workflow.vercel.app/app/cases)`,
            parse_mode: 'Markdown',
          });
        } else {
          await tgSend(botToken, 'sendMessage', {
            chat_id: chatId,
            text: '🔍 *Active 케이스:*\n캐시된 케이스가 없습니다.\n[LUMOS에서 확인](https://lumos-workflow.vercel.app/app/cases)',
            parse_mode: 'Markdown',
          });
        }
      }

      if (text === '/lumos_weekly' || text.startsWith('/lumos_weekly@')) {
        const cached = await getCachedData();
        let msg = '📋 *이번 주 보드:*\n';
        if (cached?.goals && cached.goals.length > 0) {
          msg += '\n🎯 *이번 주 목표:*\n';
          msg += cached.goals.map((g, i) => `${i + 1}. ${g}`).join('\n');
        } else {
          msg += '\n⚠️ 설정된 목표가 없습니다.';
        }
        // 팀원별 진행률 요약
        if (cached?.members) {
          msg += '\n\n📊 *팀원별 진행률:*\n';
          for (const name of MEMBERS) {
            const info = cached.members[name];
            if (info && info.total > 0) {
              const pct = Math.round((info.done / info.total) * 100);
              const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
              msg += `${name}: ${bar} ${pct}% (${info.done}/${info.total})\n`;
            }
          }
        }
        msg += '\n[상세 보기](https://lumos-workflow.vercel.app/app/weekly)';
        await tgSend(botToken, 'sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
        });
      }
    }

    // ── 2) Callback query 처리 ──
    if (update.callback_query) {
      const callbackId = update.callback_query.id;
      const data = update.callback_query.data as string;
      const chatId = update.callback_query.message?.chat.id;
      const messageId = update.callback_query.message?.message_id;

      await tgSend(botToken, 'answerCallbackQuery', {
        callback_query_id: callbackId,
      });

      // 취소: 메시지 삭제
      if (data === 'cancel' && chatId && messageId) {
        await tgSend(botToken, 'deleteMessage', {
          chat_id: chatId,
          message_id: messageId,
        });
        return res.status(200).json({ ok: true });
      }

      if (data.startsWith('status:') && chatId) {
        const memberName = data.split(':')[1];
        const cached = await getCachedData();

        if (cached?.members && cached.members[memberName]) {
          const info = cached.members[memberName];
          const progress = info.total > 0
            ? `${info.done}/${info.total} (${Math.round((info.done / info.total) * 100)}%)`
            : '할 일 없음';
          const taskList = info.tasks.length > 0
            ? info.tasks.map((t, i) => {
                // ✅ 완료 → 취소선, ⬜ 미완료 → 그대로
                if (t.startsWith('✅')) {
                  return `${i + 1}. ~${t.slice(2).trim()}~`;
                }
                return `${i + 1}. ${t}`;
              }).join('\n')
            : '배정된 할 일 없음';

          await tgSend(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `👤 *${memberName}* 이번 주 현황\n\n✅ 완료율: ${progress}\n\n📝 *할 일 목록:*\n${taskList}`,
            parse_mode: 'Markdown',
          });
        } else {
          await tgSend(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `👤 *${memberName}*\n\n⚠️ 캐시된 데이터가 없습니다.\n워크플로우 주간 보드 페이지를 한 번 열어주세요.`,
            parse_mode: 'Markdown',
          });
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[telegram-webhook] Error:', err);
    return res.status(200).json({ ok: true });
  }
}
