import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCases } from '../hooks/useStore';
import { PriorityBadge } from '../components/shared';
import { Modal } from '../components/shared';
import { CaseTasksTab } from '../components/CaseTasksTab';
import { CaseArtifactsTab } from '../components/CaseArtifactsTab';
import { CaseDiscussionTab } from '../components/CaseDiscussionTab';
import type { CaseStatus, CasePriority, CaseIncidentData, ScoreTimelineEntry } from '../types';

type TabId = 'tasks' | 'artifacts' | 'discussion';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'discussion', label: 'Discussion' },
];

const STATUS_OPTIONS: CaseStatus[] = ['active', 'review', 'closed'];

function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, edit, remove } = useCases();
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const inc = caseData.incidentData;
  const hasIncidentData = !!inc;

  return (
    <div>
      {/* 뒤로 가기 */}
      <button className="btn btn-ghost" onClick={() => navigate('/app/cases')} style={{ marginBottom: 16 }}>
        ← 케이스 목록
      </button>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 className="page-title" style={{ flex: 1 }}>{caseData.title}</h1>
          <PriorityBadge priority={caseData.priority} />
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>수정</button>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-priority-high)' }}>정말 삭제?</span>
              <button className="btn btn-sm" style={{ background: 'var(--color-priority-high)', color: '#fff' }} onClick={async () => { await remove(caseData.id); navigate('/app/cases'); }}>삭제</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>취소</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-priority-high)' }} onClick={() => setConfirmDelete(true)}>삭제</button>
          )}
        </div>

        {/* 상태 전환 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>상태:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUS_OPTIONS.map((s) => (
              <button key={s} className={`btn btn-sm ${caseData.status === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => edit(caseData.id, { status: s })}>
                {s === 'active' && '진행 중'}{s === 'review' && '검토'}{s === 'closed' && '완료'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── LUMOS 사고 개요 카드 ── */}
      {hasIncidentData && inc ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {/* 사고 개요 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>Hacked Amount</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#333' }}>{formatUsd(inc.hackedAmount)}</div>
              </div>
              {inc.lumosScore != null && (
                <div style={{
                  padding: '6px 14px', borderRadius: 16, fontWeight: 700, fontSize: 16,
                  background: inc.lumosScore >= 70 ? '#E8F5E9' : inc.lumosScore >= 40 ? '#FFF8E1' : '#FFEBEE',
                  color: inc.lumosScore >= 70 ? '#2E7D32' : inc.lumosScore >= 40 ? '#F57F17' : '#C62828',
                }}>
                  {inc.lumosScore}/100
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, fontSize: 'var(--font-size-sm)' }}>
              <InfoRow label="Hacked Date" value={new Date(inc.hackedDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <InfoRow label="Chain" value={inc.chain} />
              <InfoRow label="Audit Status" value={inc.auditStatus === true ? 'Yes' : inc.auditStatus === false ? 'No' : '—'} />
              <InfoRow label="Incident Code" value={inc.incidentCode || '—'} />
            </div>

            {/* Attack Vector */}
            {inc.attackVector.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>Attack Vector</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {inc.attackVector.map((v, i) => (
                    <span key={i} style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: '#F3E8FF', color: '#7C3AED',
                    }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {inc.summary && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border-light)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 'var(--font-size-sm)' }}>Summary</div>
                <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.7 }}>
                  {inc.summary}
                </p>
              </div>
            )}
          </div>

          {/* LUMOS Score Timeline */}
          {inc.scoreTimeline.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>
                LUMOS Score Criteria
              </div>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* 수직 라인 */}
                <div style={{
                  position: 'absolute', left: 7, top: 8, bottom: 8, width: 2,
                  background: 'linear-gradient(to bottom, #9F34B4, #D8A8E8)',
                }} />
                {inc.scoreTimeline.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, position: 'relative' }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginLeft: -20,
                      background: entry.status === 'completed' ? '#9F34B4' : entry.status === 'pending' ? '#D8A8E8' : '#ddd',
                      border: '3px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                    }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{entry.label}</div>
                      <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {entry.date ? new Date(entry.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Update'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exploited Fund Destination */}
          {inc.fundDestination && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>
                Exploited Fund Destination
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{inc.fundDestination.methods.join(', ')}</span>
                <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>— {inc.fundDestination.status}</span>
              </div>
              {inc.fundDestination.addresses.length > 0 && (
                <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 12px', background: 'var(--color-bg-secondary)', fontSize: 11, fontWeight: 600, color: '#888' }}>
                    <span>Address & Transaction</span><span>Link</span>
                  </div>
                  {inc.fundDestination.addresses.map((a, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 12px', borderTop: '1px solid var(--color-border-light)', alignItems: 'center' }}>
                      <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{a.address}</code>
                      {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16 }}>↗</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audit History */}
          {inc.auditHistory && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>
                Audit History
              </div>
              <AuditSection title="Pre-Hack" entries={inc.auditHistory.preHack} />
              <AuditSection title="Post-Hack" entries={inc.auditHistory.postHack} />
            </div>
          )}
        </div>
      ) : (
        /* 기존 description + metadata (하위호환) */
        <div style={{ marginBottom: 24 }}>
          {caseData.description && (
            <p className="text-secondary" style={{ marginBottom: 12, fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
              {caseData.description}
            </p>
          )}
          {Object.keys(caseData.metadata).length > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(caseData.metadata).map(([key, value]) => (
                <div key={key} style={{ fontSize: 'var(--font-size-xs)' }}>
                  <span className="text-tertiary">{key}: </span>
                  <span className="text-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 탭 */}
      <div className="tabs">
        {TABS.map((tab) => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && <CaseTasksTab caseId={caseData.id} />}
      {activeTab === 'artifacts' && <CaseArtifactsTab caseId={caseData.id} />}
      {activeTab === 'discussion' && <CaseDiscussionTab caseId={caseData.id} caseTitle={caseData.title} />}

      {/* 수정 모달 */}
      <EditCaseModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        caseData={caseData}
        onSave={async (changes) => {
          await edit(caseData.id, changes);
          setShowEditModal(false);
        }}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{value}</div>
    </div>
  );
}

function AuditSection({ title, entries }: { title: string; entries: Array<{ auditor: string; scope: string; date: string }> }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, padding: '6px 12px', background: 'var(--color-bg-secondary)',
        borderRadius: '6px 6px 0 0', color: '#888',
      }}>
        {title}
      </div>
      <div style={{ border: '1px solid var(--color-border-light)', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 12 }}>
        {entries.length === 0 ? (
          <div className="text-tertiary" style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
            No publicly disclosed audit report found.
          </div>
        ) : (
          entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{e.auditor}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: e.scope === 'In Scope' ? '#10B981' : '#F59E0B' }}>{e.scope}</div>
              </div>
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                {new Date(e.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 수정 모달 (확장됨) ──
function EditCaseModal({
  isOpen, onClose, caseData, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  caseData: { title: string; priority: CasePriority; description: string; metadata: Record<string, string>; incidentData?: CaseIncidentData };
  onSave: (changes: Partial<{ title: string; priority: CasePriority; description: string; metadata: Record<string, string>; incidentData: CaseIncidentData }>) => Promise<void>;
}) {
  const inc = caseData.incidentData;

  const [title, setTitle] = useState(caseData.title);
  const [priority, setPriority] = useState(caseData.priority);
  const [description, setDescription] = useState(caseData.description);

  // incident data fields
  const [hackedAmount, setHackedAmount] = useState(String(inc?.hackedAmount ?? ''));
  const [hackedDate, setHackedDate] = useState(inc?.hackedDate ?? '');
  const [chain, setChain] = useState(inc?.chain ?? caseData.metadata?.chain ?? '');
  const [protocol, setProtocol] = useState(inc?.protocol ?? caseData.metadata?.protocol ?? '');
  const [attackVectorStr, setAttackVectorStr] = useState((inc?.attackVector ?? []).join(', '));
  const [incidentCode, setIncidentCode] = useState(inc?.incidentCode ?? '');
  const [lumosScore, setLumosScore] = useState(String(inc?.lumosScore ?? ''));
  const [auditStatus, setAuditStatus] = useState<string>(inc?.auditStatus === true ? 'yes' : inc?.auditStatus === false ? 'no' : 'unknown');
  const [summary, setSummary] = useState(inc?.summary ?? '');

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const metadata: Record<string, string> = { ...caseData.metadata };
    if (protocol.trim()) metadata.protocol = protocol.trim();
    if (chain.trim()) metadata.chain = chain.trim();

    const incidentData: CaseIncidentData = {
      hackedAmount: parseInt(hackedAmount) || 0,
      hackedDate: hackedDate || new Date().toISOString().slice(0, 10),
      chain: chain.trim(),
      protocol: protocol.trim(),
      attackVector: attackVectorStr.split(',').map((s) => s.trim()).filter(Boolean),
      incidentCode: incidentCode.trim(),
      lumosScore: lumosScore ? parseInt(lumosScore) : null,
      auditStatus: auditStatus === 'yes' ? true : auditStatus === 'no' ? false : null,
      scoreTimeline: inc?.scoreTimeline ?? defaultTimeline(hackedDate),
      fundDestination: inc?.fundDestination ?? null,
      auditHistory: inc?.auditHistory ?? null,
      summary: summary.trim(),
    };

    await onSave({ title: title.trim(), priority, description: description.trim(), metadata, incidentData });
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="케이스 수정"
      actions={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
        <FormField label="제목">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </FormField>

        <FormField label="우선순위">
          <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </FormField>

        <FormField label="설명">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </FormField>

        <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, color: '#9F34B4' }}>📊 사고 데이터</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="피해금액 (USD)">
            <input type="number" value={hackedAmount} onChange={(e) => setHackedAmount(e.target.value)} placeholder="1200000" />
          </FormField>
          <FormField label="사고 일자">
            <input type="date" value={hackedDate} onChange={(e) => setHackedDate(e.target.value)} />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Protocol">
            <input type="text" value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="CrossCurve" />
          </FormField>
          <FormField label="Chain">
            <input type="text" value={chain} onChange={(e) => setChain(e.target.value)} placeholder="Ethereum" />
          </FormField>
        </div>

        <FormField label="Attack Vector (쉼표 구분)">
          <input type="text" value={attackVectorStr} onChange={(e) => setAttackVectorStr(e.target.value)} placeholder="Contract Vulnerability, Logic Bug" />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Incident Code">
            <input type="text" value={incidentCode} onChange={(e) => setIncidentCode(e.target.value)} placeholder="SHA1020" />
          </FormField>
          <FormField label="LUMOS Score (0~100)">
            <input type="number" min={0} max={100} value={lumosScore} onChange={(e) => setLumosScore(e.target.value)} placeholder="75" />
          </FormField>
          <FormField label="Audit Status">
            <select value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)}>
              <option value="unknown">미확인</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FormField>
        </div>

        <FormField label="Summary">
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="사고 요약..." />
        </FormField>
      </div>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>{label}</label>
      {children}
    </div>
  );
}

function defaultTimeline(hackedDate: string): ScoreTimelineEntry[] {
  return [
    { label: 'Pre-Incident Audit', date: null, status: 'none' },
    { label: 'Hacked', date: hackedDate || null, status: hackedDate ? 'completed' : 'none' },
    { label: 'Post-Mortem Release', date: null, status: 'none' },
    { label: 'Community Compensation', date: null, status: 'none' },
    { label: 'Post-Incident Audit', date: null, status: 'none' },
  ];
}
