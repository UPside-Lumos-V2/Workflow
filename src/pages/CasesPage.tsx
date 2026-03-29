import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useTasks } from '../hooks/useStore';
import { StatusBadge, PriorityBadge, EmptyState } from '../components/shared';
import { CreateCaseModal } from '../components/CreateCaseModal';
import type { CaseStatus } from '../types';

const FILTER_TABS: Array<{ label: string; value: CaseStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: '진행 중', value: 'active' },
  { label: '검토', value: 'review' },
  { label: '완료', value: 'closed' },
];

export function CasesPage() {
  const { items: cases, loading, add } = useCases();
  const { items: tasks } = useTasks();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CaseStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = filter === 'all' ? cases : cases.filter((c) => c.status === filter);

  const getTaskCount = (caseId: string) => tasks.filter((t) => t.caseId === caseId).length;

  if (loading) {
    return <div className="empty-state"><p className="text-secondary">Loading...</p></div>;
  }

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
          {filtered.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/app/cases/${c.id}`)}
            >
              <div className="card-header">
                <span className="card-title">{c.title}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <PriorityBadge priority={c.priority} />
                  <StatusBadge status={c.status} />
                </div>
              </div>
              {c.description && (
                <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 8 }}>
                  {c.description.slice(0, 120)}{c.description.length > 120 ? '...' : ''}
                </p>
              )}
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                {getTaskCount(c.id)} tasks
                {c.metadata?.protocol && ` · ${c.metadata.protocol}`}
                {c.metadata?.chain && ` · ${c.metadata.chain}`}
              </div>
            </div>
          ))}
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
