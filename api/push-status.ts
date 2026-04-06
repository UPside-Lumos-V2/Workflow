import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 프론트엔드에서 주간 현황 데이터를 Supabase bot_weekly_cache에 push
 * 포함 데이터: members(할일), goals(목표), cases(활성 케이스)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const { members, goals, cases } = req.body as {
      members?: Record<string, { total: number; done: number; tasks: string[] }>;
      goals?: string[];
      cases?: { title: string; priority: string; protocol: string; chain: string }[];
      // 하위호환: 이전 memberSummaries 키
      memberSummaries?: Record<string, { total: number; done: number; tasks: string[] }>;
    };

    const data = {
      members: members ?? req.body.memberSummaries ?? {},
      goals: goals ?? [],
      cases: cases ?? [],
    };

    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/bot_weekly_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 'current',
        data,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      return res.status(upsertRes.status).json({ error: err });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
