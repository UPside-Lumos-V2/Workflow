import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useWeekly, useNotes, useMembers } from '../hooks/useStore';
import { getWeekStartDate } from '../lib/date';
import type { MemberTask } from '../types';
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

// ── 색상 팔레트 ──
const CHART_COLORS = {
  primary: '#9a1db9',
  primaryLight: '#DFB0E8',
  done: '#10B981',
  notDone: '#E5E7EB',
  carry: '#F59E0B',
  active: '#3B82F6',
  review: '#8B5CF6',
  closed: '#10B981',
};

// ── DashCard (기존) ──
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

// ── ChartCard ──
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 'var(--font-size-base)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── 주간 통계 계산 유틸 ──
function calcWeeklyStats(
  memberTasks: Record<string, MemberTask[]> | undefined,
  carryOver: string[] | undefined,
) {
  if (!memberTasks) return { total: 0, done: 0, notDone: 0, carry: carryOver?.length ?? 0 };
  let total = 0;
  let done = 0;
  for (const [memberId, tasks] of Object.entries(memberTasks)) {
    if (memberId === 'unassigned') continue;
    total += tasks.length;
    done += tasks.filter((t) => t.done).length;
  }
  return { total, done, notDone: total - done, carry: carryOver?.length ?? 0 };
}

// ── 커스텀 Tooltip ──
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span>{p.name}: <b>{p.value}</b></span>
        </div>
      ))}
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
    () => weeklies.find((w) => w.weekStart === getWeekStartDate()),
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
      if (memberId === 'unassigned') continue;
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

  // ═══ Phase 13: 차트 데이터 계산 ═══

  // T13.2 — 주간 완료율 추이 (최근 8주)
  const weeklyTrendData = useMemo(() => {
    const sorted = [...weeklies].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return sorted.slice(-8).map((w) => {
      const stats = calcWeeklyStats(w.memberTasks, w.carryOver);
      const rate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      const shortLabel = w.weekLabel.replace(/^Week \d+ /, '');
      return { week: shortLabel, 완료율: rate, 완료: stats.done, 전체: stats.total };
    });
  }, [weeklies]);

  // T13.3 — 케이스 분포
  const casePieData = useMemo(() => [
    { name: '진행 중', value: caseStats.active, color: CHART_COLORS.active },
    { name: '검토', value: caseStats.review, color: CHART_COLORS.review },
    { name: '완료', value: caseStats.closed, color: CHART_COLORS.closed },
  ].filter((d) => d.value > 0), [caseStats]);

  // T13.4 — 팀원별 기여도 (이번 주)
  const memberBarData = useMemo(() => {
    return Object.entries(memberTaskSummary.grouped).map(([id, stats]) => ({
      name: getMemberName(id) || id.slice(0, 4),
      완료: stats.done,
      미완료: stats.total - stats.done,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberTaskSummary, members]);

  // T13.5 — 주간별 이력 타임라인 (최근 8주)
  const weeklyTimelineData = useMemo(() => {
    const sorted = [...weeklies].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return sorted.slice(-8).map((w) => {
      const stats = calcWeeklyStats(w.memberTasks, w.carryOver);
      const shortLabel = w.weekLabel.replace(/^Week \d+ /, '');
      return { week: shortLabel, 완료: stats.done, 미완료: stats.notDone, 이월: stats.carry };
    });
  }, [weeklies]);

  // T13.6 — 누적 통계
  const cumulativeStats = useMemo(() => {
    let totalTasks = 0;
    let totalDone = 0;
    let totalCarry = 0;
    weeklies.forEach((w) => {
      const stats = calcWeeklyStats(w.memberTasks, w.carryOver);
      totalTasks += stats.total;
      totalDone += stats.done;
      totalCarry += stats.carry;
    });
    return {
      전체: totalTasks,
      완료: totalDone,
      미완료: totalTasks - totalDone,
      이월: totalCarry,
      완료율: totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0,
    };
  }, [weeklies]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
      </div>

      {/* ══════════════ 기존 영역 (100% 보존) ══════════════ */}

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

      {/* ══════════════ Phase 13: 시각화 차트 영역 ══════════════ */}

      {/* ── T13.6: 누적 통계 요약 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginTop: 32,
        marginBottom: 16,
      }}>
        {[
          { label: '총 할 일', value: cumulativeStats.전체, color: '#111' },
          { label: '완료', value: cumulativeStats.완료, color: CHART_COLORS.done },
          { label: '미완료', value: cumulativeStats.미완료, color: '#EF4444' },
          { label: '이월', value: cumulativeStats.이월, color: CHART_COLORS.carry },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{
            padding: '16px 18px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── 차트 2열 레이아웃 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
        marginBottom: 16,
      }}>
        {/* T13.2 — 주간 완료율 추이 */}
        <ChartCard title="주간 완료율 추이">
          {weeklyTrendData.length < 2 ? (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)', padding: '40px 0', textAlign: 'center' }}>
              2주 이상의 데이터가 필요합니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradientPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="완료율"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2.5}
                  fill="url(#gradientPurple)"
                  dot={{ fill: CHART_COLORS.primary, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* T13.3 — 케이스 분포 */}
        <ChartCard title="케이스 상태 분포">
          {cases.length === 0 ? (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)', padding: '40px 0', textAlign: 'center' }}>
              케이스가 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={casePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {casePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* T13.4 — 팀원별 기여도 */}
        <ChartCard title="팀원별 기여도 (이번 주)">
          {memberBarData.length === 0 ? (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)', padding: '40px 0', textAlign: 'center' }}>
              이번 주 할 일이 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={memberBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>}
                />
                <Bar dataKey="완료" stackId="a" fill={CHART_COLORS.done} radius={[0, 0, 0, 0]} />
                <Bar dataKey="미완료" stackId="a" fill={CHART_COLORS.notDone} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* T13.5 — 주간 이력 타임라인 */}
        <ChartCard title="주간별 할 일 이력">
          {weeklyTimelineData.length === 0 ? (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-sm)', padding: '40px 0', textAlign: 'center' }}>
              주간 데이터가 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyTimelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>}
                />
                <Bar dataKey="완료" stackId="a" fill={CHART_COLORS.done} />
                <Bar dataKey="미완료" stackId="a" fill="#EF4444" />
                <Bar dataKey="이월" stackId="a" fill={CHART_COLORS.carry} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
