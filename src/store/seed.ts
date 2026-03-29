import { supabase } from '../lib/supabase';

const SEED_MEMBERS = [
  { name: 'Erwin', role_description: '' },
  { name: 'n4mchun', role_description: '' },
  { name: 'Omin', role_description: '' },
  { name: 'Tamaneko', role_description: '' },
  { name: 'Wi11y', role_description: '' },
  { name: 'Wiimdy', role_description: '' },
  { name: 'Yham', role_description: '' },
  { name: 'Zeroluck', role_description: 'mentor' }
];

export async function initSeedData(): Promise<void> {
  if (!supabase) return;

  // Members가 비어있을 때만 시드
  const { data: existing } = await supabase
    .from('lumos_members')
    .select('id')
    .limit(1);

  if (existing && existing.length > 0) return;

  // Members 삽입
  const { data: members, error: mErr } = await supabase
    .from('lumos_members')
    .insert(SEED_MEMBERS)
    .select();

  if (mErr || !members) {
    console.error('Seed members failed:', mErr);
    return;
  }

  // Case 1개
  const { data: cases, error: cErr } = await supabase
    .from('lumos_cases')
    .insert({
      title: 'CrossCurve Flash Loan Exploit',
      status: 'in-progress',
      priority: 'high',
      description: 'CrossCurve 프로토콜 Flash Loan 공격 분석',
      metadata: { protocol: 'CrossCurve', chain: 'Ethereum', loss_usd: '1200000' },
    })
    .select()
    .single();

  if (cErr || !cases) {
    console.error('Seed case failed:', cErr);
    return;
  }

  // Tasks 3개
  await supabase.from('lumos_tasks').insert([
    {
      case_id: cases.id,
      title: '공격 트랜잭션 분석',
      status: 'in-progress',
      label: '분석',
      assignee_id: members[0].id,
      sort_order: 0,
    },
    {
      case_id: cases.id,
      title: 'PoC 스켈레톤 작성',
      status: 'todo',
      label: '개발',
      assignee_id: members[1].id,
      sort_order: 1,
    },
    {
      case_id: cases.id,
      title: '유사 사례 조사',
      status: 'todo',
      label: '조사',
      assignee_id: null,
      sort_order: 2,
    },
  ]);

  // Weekly 1개
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  await supabase.from('lumos_weeklies').insert({
    week_label: `Week ${Math.ceil(today.getDate() / 7)} (${monday.getMonth() + 1}/${monday.getDate()} ~ ${monday.getMonth() + 1}/${monday.getDate() + 6})`,
    week_start: monday.toISOString().split('T')[0],
    goals: ['CrossCurve Exploit 분석 완료', '주간 보고서 작성'],
    active_case_ids: [cases.id],
    mentoring_agenda: '공격 벡터 분류 기준 논의',
    mentoring_feedback: '',
    mentoring_action_items: [],
    carry_over: [],
  });

  console.log('✅ LUMOS seed data initialized');
}
