import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useWeekly, useNotes, useMembers } from '../hooks/useStore';

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function DashCard({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      className="card"
      style={{ padding: '20px 22px', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { items: cases } = useCases();
  const { items: weeklies } = useWeekly();
  const { items: notes } = useNotes();
  const { items: members } = useMembers();

  const currentWeekly = useMemo(
    () => weeklies.find((w) => w.weekStart === getWeekStart()),
    [weeklies],
  );

  const caseStats = useMemo(() => {
    const counts = { active: 0, review: 0, closed: 0 };
    cases.forEach((c) => { counts[c.status]++; });
    return counts;
  }, [cases]);

  // 팀원별 할 일 + 완료 계산
  const memberTaskSummary = useMemo(() => {
    if (!currentWeekly?.memberTasks) return { total: 0, done: 0, grouped: {} as Record<string, { total: number; done: number }> };
    const grouped: Record<string, { total: number; done: number }> = {};
    let total = 0;
    let done = 0;
    for (const [memberId, tasks] of Object.entries(currentWeekly.memberTasks)) {
      if (memberId === 'unassigned') continue; // 미배정 제외
      if (tasks.length > 0) {
        const memberDone = tasks.filter((t) => t.done).length;
        grouped[memberId] = { total: tasks.length, done: memberDone };
        total += tasks.length;
        done += memberDone;
      }
    }
    return { total, done, grouped };
  }, [currentWeekly]);

  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [notes],
  );

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? '';
  const progress = memberTaskSummary.total > 0
    ? Math.round((memberTaskSummary.done / memberTaskSummary.total) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
      </div>

      {/* ── 1행: 이번 주 현황 (전체 너비) ── */}
      <div
        className="card"
        style={{ padding: '24px 28px', marginBottom: 16, cursor: 'pointer' }}
        onClick={() => navigate('/app/weekly')}
      >
        <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 'var(--font-size-base)' }}>
          이번 주 현황
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          {/* 좌: 목표 리스트 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 10, color: 'var(--color-text-secondary)' }}>목표</div>
            {currentWeekly && currentWeekly.goals.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentWeekly.goals.map((g, i) => (
                  <li key={i} style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>{g}</li>
                ))}
              </ul>
            ) : (
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)' }}>
                주간 보드에서 목표를 설정하세요
              </div>
            )}
          </div>

          {/* 우: 원형 진행률 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#DFB0E8" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="#9a1db9ff"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '22px', fontWeight: 700, fill: '#9F34B4' }}
              >
                {progress}%
              </text>
            </svg>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 6 }}>
              {memberTaskSummary.done}/{memberTaskSummary.total} 할 일 완료
            </div>
          </div>
        </div>
      </div>

      {/* ── 2행: 3칸 카드 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {/* 케이스 현황 */}
        <DashCard title="케이스 현황" onClick={() => navigate('/app/cases')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { key: 'active' as const, label: '진행 중' },
              { key: 'review' as const, label: '검토' },
              { key: 'closed' as const, label: '완료' },
            ]).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                <span>{label}</span>
                <span style={{ fontWeight: 600 }}>{caseStats[key]}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#9F34B4' }}>
              <span>전체</span>
              <span>{cases.length}</span>
            </div>
          </div>
        </DashCard>

        {/* 팀원별 할 일 */}
        <DashCard title={`이번 주 할 일 (${memberTaskSummary.total}건)`} onClick={() => navigate('/app/weekly')}>
          {memberTaskSummary.total === 0 ? (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)' }}>
              주간 보드에서 할 일을 추가하세요
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(memberTaskSummary.grouped).map(([id, stats]) => (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                  <span>{getMemberName(id) || '미할당'}</span>
                  <span style={{ fontWeight: 600 }}>{stats.done}/{stats.total}</span>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* 최근 노트 */}
        <DashCard title="최근 노트" onClick={recentNotes.length > 0 ? () => navigate('/app/notes') : undefined}>
          {recentNotes.length === 0 ? (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)' }}>
              아직 노트가 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentNotes.map((n) => (
                <div
                  key={n.id}
                  style={{ cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/app/notes/${n.id}`); }}
                >
                  <div style={{ fontWeight: 500 }}>{n.title || '제목 없음'}</div>
                  <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {new Date(n.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}
