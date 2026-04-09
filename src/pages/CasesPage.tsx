import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useTasks } from '../hooks/useStore';
import { StatusBadge, PriorityBadge, EmptyState } from '../components/shared';
import { CreateCaseModal } from '../components/CreateCaseModal';
import type { CaseStatus, Case } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const FILTER_TABS: Array<{ label: string; value: CaseStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: '진행 중', value: 'active' },
  { label: '검토', value: 'review' },
  { label: '완료', value: 'closed' },
];

/** 피해금액 포맷 */
function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

/** 월 라벨 */
function monthLabel(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 피해금액 추출 (incidentData → metadata fallback) */
function getHackedAmount(c: Case): number {
  if (c.incidentData?.amount != null) return c.incidentData.amount;
  if (c.metadata?.lossUsd) return parseInt(c.metadata.lossUsd) || 0;
  if (c.metadata?.loss_usd) return parseInt(c.metadata.loss_usd) || 0;
  return 0;
}

function getHackedDate(c: Case): string {
  return c.incidentData?.hackedAt || c.createdAt;
}

function getProtocol(c: Case): string {
  return c.title;
}

export function CasesPage() {
  const { items: cases, loading, add } = useCases();
  const { items: tasks } = useTasks();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CaseStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = filter === 'all' ? cases : cases.filter((c) => c.status === filter);
  const getTaskCount = (caseId: string) => tasks.filter((t) => t.caseId === caseId).length;

  // ── 차트 데이터: 월별 피해금액 ──
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    cases.forEach((c) => {
      const month = monthLabel(getHackedDate(c));
      map[month] = (map[month] || 0) + getHackedAmount(c);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));
  }, [cases]);

  // ── Top 5 피해 프로젝트 ──
  const top5 = useMemo(() => {
    return [...cases]
      .map((c) => ({ name: getProtocol(c), amount: getHackedAmount(c) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [cases]);

  // ── 통계 ──
  const stats = useMemo(() => {
    const totalLoss = cases.reduce((sum, c) => sum + getHackedAmount(c), 0);
    const activeCount = cases.filter((c) => c.status === 'active').length;
    const scores = cases
      .map((c) => c.incidentData?.lumosScore)
      .filter((s): s is number => s != null);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { totalLoss, activeCount, avgScore };
  }, [cases]);

  if (loading) {
    return <div className="empty-state"><p className="text-secondary">Loading...</p></div>;
  }

  const CHART_COLOR = '#9F34B4';
  const CHART_COLOR_LIGHT = '#D8A8E8';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-subtitle">{cases.length}개의 보안 사고 케이스</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + 새 케이스
        </button>
      </div>

      {/* ── 시각화 대시보드 ── */}
      {cases.length > 0 && (
        <>
          {/* 차트 영역 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16,
          }}>
            {/* 왼쪽: 월별 피해금액 Bar 차트 */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                  월별 피해금액 (USD)
                </span>
                <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Total: {formatUsd(stats.totalLoss)}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatUsd(v)} width={60} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatUsd(Number(value)), '피해금액']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 13 }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {monthlyData.map((_, idx) => (
                      <Cell key={idx} fill={idx === monthlyData.length - 1 ? CHART_COLOR : CHART_COLOR_LIGHT} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 오른쪽: Top 5 사고 */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 12 }}>
                Top 5 피해 프로젝트
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top5} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatUsd(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#555' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatUsd(Number(value)), '피해금액']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 13 }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={20} fill={CHART_COLOR} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 통계 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>총 피해금액</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: CHART_COLOR }}>{formatUsd(stats.totalLoss)}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>진행중 케이스</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.activeCount}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>평균 LUMOS Score</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: stats.avgScore ? CHART_COLOR : '#ccc' }}>
                {stats.avgScore != null ? `${stats.avgScore}/100` : '—'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 필터 탭 */}
      <div className="tabs">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`tab ${filter === tab.value ? 'active' : ''}`}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className="text-tertiary" style={{ marginLeft: 4 }}>
                {cases.filter((c) => c.status === tab.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 케이스 목록 */}
      {filtered.length === 0 ? (
        <EmptyState
          message={filter === 'all' ? '아직 케이스가 없습니다' : `${filter} 상태의 케이스가 없습니다`}
          actionLabel={filter === 'all' ? '새 케이스 만들기' : undefined}
          onAction={filter === 'all' ? () => setShowCreateModal(true) : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((c) => {
            const amount = getHackedAmount(c);
            const score = c.incidentData?.lumosScore;
            return (
              <div
                key={c.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/app/cases/${c.id}`)}
              >
                <div className="card-header">
                  <span className="card-title">{c.title}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {score != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 12, background: score >= 70 ? '#E8F5E9' : score >= 40 ? '#FFF8E1' : '#FFEBEE',
                        color: score >= 70 ? '#2E7D32' : score >= 40 ? '#F57F17' : '#C62828',
                      }}>
                        {score}/100
                      </span>
                    )}
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                {c.description && (
                  <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 8 }}>
                    {c.description.slice(0, 120)}{c.description.length > 120 ? '...' : ''}
                  </p>
                )}
                <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{getTaskCount(c.id)} tasks</span>
                  {amount > 0 && <span>💰 {formatUsd(amount)}</span>}
                  {c.incidentData?.chains?.length ? <span>⛓ {c.incidentData.chains.join(', ')}</span> : c.metadata?.chain && <span>⛓ {c.metadata.chain}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 생성 모달 */}
      <CreateCaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (input) => {
          await add(input);
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}
