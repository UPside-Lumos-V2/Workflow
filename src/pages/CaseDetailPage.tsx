import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCases } from '../hooks/useStore';
import { PriorityBadge } from '../components/shared';
import { Modal } from '../components/shared';
import { CaseTasksTab } from '../components/CaseTasksTab';
import { CaseArtifactsTab } from '../components/CaseArtifactsTab';
import { CaseDiscussionTab } from '../components/CaseDiscussionTab';
import type { CaseStatus, CasePriority } from '../types';

type TabId = 'tasks' | 'artifacts' | 'discussion';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'discussion', label: 'Discussion' },
];

const STATUS_OPTIONS: CaseStatus[] = ['open', 'in-progress', 'review', 'closed'];

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, edit, remove } = useCases();
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [showEditModal, setShowEditModal] = useState(false);

  const caseData = getById(id ?? '');

  if (!caseData) {
    return (
      <div className="empty-state">
        <p>케이스를 찾을 수 없습니다</p>
        <button className="btn btn-secondary" onClick={() => navigate('/app/cases')}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 뒤로 가기 */}
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/app/cases')}
        style={{ marginBottom: 16 }}
      >
        ← Cases
      </button>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 className="page-title" style={{ flex: 1 }}>{caseData.title}</h1>
          <PriorityBadge priority={caseData.priority} />
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            수정
          </button>
        </div>

        {/* 상태 전환 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>상태:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${caseData.status === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => edit(caseData.id, { status: s })}
              >
                {s === 'open' && 'Open'}
                {s === 'in-progress' && 'In Progress'}
                {s === 'review' && 'Review'}
                {s === 'closed' && 'Closed'}
              </button>
            ))}
          </div>
        </div>

        {/* 설명 */}
        {caseData.description && (
          <p className="text-secondary" style={{ marginTop: 12, fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
            {caseData.description}
          </p>
        )}

        {/* 메타데이터 */}
        {Object.keys(caseData.metadata).length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(caseData.metadata).map(([key, value]) => (
              <div key={key} style={{ fontSize: 'var(--font-size-xs)' }}>
                <span className="text-tertiary">{key}: </span>
                <span className="text-mono">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'tasks' && <CaseTasksTab caseId={caseData.id} />}
      {activeTab === 'artifacts' && <CaseArtifactsTab caseId={caseData.id} />}
      {activeTab === 'discussion' && <CaseDiscussionTab caseId={caseData.id} />}

      {/* 수정 모달 */}
      <EditCaseModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        caseData={caseData}
        onSave={async (changes) => {
          await edit(caseData.id, changes);
          setShowEditModal(false);
        }}
        onDelete={async () => {
          await remove(caseData.id);
          navigate('/app/cases');
        }}
      />
    </div>
  );
}

// ── 수정 모달 ──
function EditCaseModal({
  isOpen,
  onClose,
  caseData,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  caseData: { title: string; priority: CasePriority; description: string; metadata: Record<string, string> };
  onSave: (changes: { title: string; priority: CasePriority; description: string; metadata: Record<string, string> }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(caseData.title);
  const [priority, setPriority] = useState(caseData.priority);
  const [description, setDescription] = useState(caseData.description);
  const [protocol, setProtocol] = useState(caseData.metadata?.protocol ?? '');
  const [chain, setChain] = useState(caseData.metadata?.chain ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 모달 열릴 때마다 현재 값으로 리셋
  const resetToCase = () => {
    setTitle(caseData.title);
    setPriority(caseData.priority);
    setDescription(caseData.description);
    setProtocol(caseData.metadata?.protocol ?? '');
    setChain(caseData.metadata?.chain ?? '');
    setConfirmDelete(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const metadata: Record<string, string> = { ...caseData.metadata };
    if (protocol.trim()) metadata.protocol = protocol.trim(); else delete metadata.protocol;
    if (chain.trim()) metadata.chain = chain.trim(); else delete metadata.chain;

    await onSave({
      title: title.trim(),
      priority,
      description: description.trim(),
      metadata,
    });
    setSaving(false);
  };

  const handleClose = () => {
    resetToCase();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="케이스 수정"
      actions={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-priority-high)' }}>정말 삭제?</span>
                <button className="btn btn-sm" style={{ background: 'var(--color-priority-high)', color: '#fff' }} onClick={onDelete}>삭제</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>취소</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-priority-high)' }} onClick={() => setConfirmDelete(true)}>삭제</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleClose}>취소</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      }
    >
      <div className="form-group">
        <label className="form-label">제목</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>

      <div className="form-group">
        <label className="form-label">우선순위</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Protocol</label>
          <input type="text" value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="Euler Finance" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Chain</label>
          <input type="text" value={chain} onChange={(e) => setChain(e.target.value)} placeholder="Ethereum" />
        </div>
      </div>
    </Modal>
  );
}
