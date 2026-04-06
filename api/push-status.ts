import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 프론트엔드에서 주간 현황 데이터를 Supabase bot_weekly_cache에 push
 * WeeklyPage에서 데이터 변경 시 호출됨
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
    const { memberSummaries } = req.body as {
      memberSummaries: Record<string, { total: number; done: number; tasks: string[] }>;
    };

    if (!memberSummaries) {
      return res.status(400).json({ error: 'memberSummaries required' });
    }

    // Supabase REST API — upsert
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
        data: memberSummaries,
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
