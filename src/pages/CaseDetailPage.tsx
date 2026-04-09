import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCases } from '../hooks/useStore';
import { PriorityBadge } from '../components/shared';
import { Modal } from '../components/shared';
import { CaseTasksTab } from '../components/CaseTasksTab';
import { CaseArtifactsTab } from '../components/CaseArtifactsTab';
import { CaseDiscussionTab } from '../components/CaseDiscussionTab';
import type {
  CaseStatus, CasePriority, CaseIncidentData, ScoreTimelineEntry,
  PreLumosAudit,
} from '../types';

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

function statusBadge(val: 'yes' | 'no' | 'rugged' | null) {
  if (val === 'yes') return <span style={{ color: '#10B981', fontWeight: 600 }}>Yes</span>;
  if (val === 'no') return <span style={{ color: '#EF4444', fontWeight: 600 }}>No</span>;
  if (val === 'rugged') return <span style={{ color: '#F59E0B', fontWeight: 600 }}>Rugged</span>;
  return <span style={{ color: '#9CA3AF' }}>—</span>;
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

  // incidentData 기본값 (pre-lumos 구조)
  const inc = caseData.incidentData ?? {
    slug: '',
    hackedAt: caseData.createdAt,
    chains: [caseData.metadata?.chain ?? ''].filter(Boolean),
    amount: parseInt(caseData.metadata?.lossUsd || caseData.metadata?.loss_usd || '0') || 0,
    category: 'Unknown',
    subcategory: null,
    summary: null,
    compensationStatus: null,
    preIncidentAuditStatus: null,
    postIncidentAuditStatus: null,
    postmortemStatus: null,
    compensation: { detail: null },
    preAudits: [],
    postAudits: [],
    postmortem: [],
    fund: null,
    twitter: null,
    website: null,
    logoImage: null,
    category2: null,
    lumosScore: null,
    scoreTimeline: [
      { label: 'Pre-Incident Audit', date: null, status: 'none' as const },
      { label: 'Hacked', date: caseData.createdAt, status: 'completed' as const },
      { label: 'Post-Mortem Release', date: null, status: 'none' as const },
      { label: 'Community Compensation', date: null, status: 'none' as const },
      { label: 'Post-Incident Audit', date: null, status: 'none' as const },
    ],
  };

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

      {/* ── 사고 개요 카드 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>Hacked Amount</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#333' }}>{formatUsd(inc.amount)}</div>
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
            <InfoRow label="Hacked Date" value={new Date(inc.hackedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} />
            <InfoRow label="Chain" value={inc.chains.join(', ') || '—'} />
            <InfoRow label="Category" value={[inc.category, inc.subcategory].filter(Boolean).join(' / ')} />
            <InfoRow label="Slug" value={inc.slug || '—'} />
          </div>

          {/* Status badges */}
          <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap', fontSize: 'var(--font-size-xs)' }}>
            <div><span className="text-tertiary">Pre-Audit: </span>{statusBadge(inc.preIncidentAuditStatus)}</div>
            <div><span className="text-tertiary">Post-Audit: </span>{statusBadge(inc.postIncidentAuditStatus)}</div>
            <div><span className="text-tertiary">Postmortem: </span>{statusBadge(inc.postmortemStatus)}</div>
            <div><span className="text-tertiary">Compensation: </span>{statusBadge(inc.compensationStatus)}</div>
          </div>

          {/* Links */}
          {(inc.website || inc.twitter) && (
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 'var(--font-size-xs)' }}>
              {inc.website && <a href={inc.website} target="_blank" rel="noopener noreferrer" style={{ color: '#9F34B4' }}>🌐 Website</a>}
              {inc.twitter && <a href={`https://twitter.com/${inc.twitter}`} target="_blank" rel="noopener noreferrer" style={{ color: '#9F34B4' }}>𝕏 @{inc.twitter}</a>}
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

          {/* Compensation detail */}
          {inc.compensation.detail && (
            <div style={{ marginTop: 12, fontSize: 'var(--font-size-sm)', color: '#10B981' }}>
              <span style={{ fontWeight: 600 }}>보상 내용: </span>{inc.compensation.detail}
            </div>
          )}
        </div>

        {/* LUMOS Score Timeline */}
        {inc.scoreTimeline.length > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>
              LUMOS Score Criteria
              <span className="text-tertiary" style={{ fontWeight: 400, fontSize: 'var(--font-size-xs)', marginLeft: 8 }}>
                (●클릭=상태변경 · 날짜클릭=수정)
              </span>
            </div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{
                position: 'absolute', left: 7, top: 8, bottom: 8, width: 2,
                background: 'linear-gradient(to bottom, #9F34B4, #D8A8E8)',
              }} />
              {inc.scoreTimeline.map((entry, i) => {
                const nextStatus = entry.status === 'none' ? 'pending' as const
                  : entry.status === 'pending' ? 'completed' as const
                  : 'none' as const;
                const statusLabel = { none: 'No Update', pending: 'In Progress', completed: 'Completed' };
                return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, position: 'relative' }}>
                  <div
                    title={`클릭: ${statusLabel[entry.status]} → ${statusLabel[nextStatus]}`}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginLeft: -20,
                      background: entry.status === 'completed' ? '#9F34B4' : entry.status === 'pending' ? '#D8A8E8' : '#ddd',
                      border: '3px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                      cursor: 'pointer', transition: 'transform 0.15s',
                    }}
                    onClick={() => {
                      const updated = [...inc.scoreTimeline];
                      updated[i] = { ...entry, status: nextStatus };
                      if (nextStatus === 'completed' && !entry.date) {
                        updated[i].date = new Date().toISOString().slice(0, 10);
                      }
                      edit(caseData.id, { incidentData: { ...inc, scoreTimeline: updated } });
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.3)'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{entry.label}</div>
                    <div
                      className="text-tertiary"
                      style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', textDecoration: 'underline dotted', textDecorationColor: 'rgba(0,0,0,0.2)' }}
                      onClick={() => {
                        const newDate = prompt('날짜 입력 (YYYY-MM-DD)', entry.date || new Date().toISOString().slice(0, 10));
                        if (newDate !== null) {
                          const updated = [...inc.scoreTimeline];
                          updated[i] = { ...entry, date: newDate || null };
                          if (newDate && entry.status === 'none') {
                            updated[i].status = 'completed';
                          }
                          edit(caseData.id, { incidentData: { ...inc, scoreTimeline: updated } });
                        }
                      }}
                    >
                      {entry.date ? new Date(entry.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Update'}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Postmortem Links */}
        {inc.postmortem.length > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>Postmortem</div>
            {inc.postmortem.map((pm, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 'var(--font-size-sm)' }}>
                <a href={pm.url} target="_blank" rel="noopener noreferrer" style={{ color: '#9F34B4', wordBreak: 'break-all' }}>{pm.url}</a>
                <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', flexShrink: 0, marginLeft: 12 }}>{pm.timestamp}</span>
              </div>
            ))}
          </div>
        )}

        {/* Exploited Fund */}
        {inc.fund && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>
              Exploited Fund Destination
            </div>
            {inc.fund.destinations.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {inc.fund.destinations.map((d, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                    background: '#FEE2E2', color: '#DC2626',
                  }}>{d}</span>
                ))}
              </div>
            )}
            {inc.fund.links.length > 0 && (
              <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 12px', background: 'var(--color-bg-secondary)', fontSize: 11, fontWeight: 600, color: '#888' }}>
                  <span>Address / Value</span><span>Link</span>
                </div>
                {inc.fund.links.map((link, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 12px', borderTop: '1px solid var(--color-border-light)', alignItems: 'center' }}>
                    <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{link.value || link.url}</code>
                    {link.url && <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16 }}>↗</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit History */}
        {(inc.preAudits.length > 0 || inc.postAudits.length > 0) && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 'var(--font-size-sm)' }}>Audit History</div>
            <AuditSection title="Pre-Hack" entries={inc.preAudits} />
            <AuditSection title="Post-Hack" entries={inc.postAudits} />
          </div>
        )}
      </div>

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

function AuditSection({ title, entries }: { title: string; entries: PreLumosAudit[] }) {
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
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{e.firm ?? '—'}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: e.scope === 'In Scope' ? '#10B981' : '#F59E0B' }}>{e.scope ?? '—'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>{e.timestamp ?? '—'}</span>
                {e.reportUrl && <a href={e.reportUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#9F34B4' }}>Report ↗</a>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 수정 모달 ──
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

  // pre-lumos fields
  const [slug, setSlug] = useState(inc?.slug ?? '');
  const [amount, setAmount] = useState(String(inc?.amount ?? ''));
  const [hackedAt, setHackedAt] = useState(inc?.hackedAt ?? '');
  const [chainsStr, setChainsStr] = useState((inc?.chains ?? []).join(', '));
  const [category, setCategory] = useState(inc?.category ?? '');
  const [subcategory, setSubcategory] = useState(inc?.subcategory ?? '');
  const [summary, setSummary] = useState(inc?.summary ?? '');
  const [preAuditStatus, setPreAuditStatus] = useState<string>(inc?.preIncidentAuditStatus ?? 'null');
  const [postAuditStatus, setPostAuditStatus] = useState<string>(inc?.postIncidentAuditStatus ?? 'null');
  const [compensationStatus, setCompensationStatus] = useState<string>(inc?.compensationStatus ?? 'null');
  const [postmortemStatus, setPostmortemStatus] = useState<string>(inc?.postmortemStatus ?? 'null');
  const [lumosScore, setLumosScore] = useState(String(inc?.lumosScore ?? ''));
  const [twitter, setTwitter] = useState(inc?.twitter ?? '');
  const [website, setWebsite] = useState(inc?.website ?? '');

  const [saving, setSaving] = useState(false);

  const toStatus = (v: string) => (v === 'null' ? null : v) as 'yes' | 'no' | 'rugged' | null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const incidentData: CaseIncidentData = {
      slug: slug.trim(),
      hackedAt: hackedAt || new Date().toISOString().slice(0, 10),
      chains: chainsStr.split(',').map((s) => s.trim()).filter(Boolean),
      amount: parseInt(amount) || 0,
      category: category.trim() || 'Unknown',
      subcategory: subcategory.trim() || null,
      summary: summary.trim() || null,
      preIncidentAuditStatus: toStatus(preAuditStatus),
      postIncidentAuditStatus: toStatus(postAuditStatus),
      compensationStatus: toStatus(compensationStatus),
      postmortemStatus: toStatus(postmortemStatus),
      compensation: inc?.compensation ?? { detail: null },
      preAudits: inc?.preAudits ?? [],
      postAudits: inc?.postAudits ?? [],
      postmortem: inc?.postmortem ?? [],
      fund: inc?.fund ?? null,
      twitter: twitter.replace('@', '').trim() || null,
      website: website.trim() || null,
      logoImage: inc?.logoImage ?? null,
      category2: inc?.category2 ?? null,
      lumosScore: lumosScore ? parseInt(lumosScore) : null,
      scoreTimeline: inc?.scoreTimeline ?? defaultTimeline(hackedAt),
    };

    await onSave({ title: title.trim(), priority, description: description.trim(), incidentData });
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
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, color: '#9F34B4' }}>📊 사고 데이터 (pre-lumos)</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Slug (ID)">
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="euler-finance-2023" />
          </FormField>
          <FormField label="피해금액 (USD)">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="197000000" />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="사고 일자">
            <input type="date" value={hackedAt} onChange={(e) => setHackedAt(e.target.value)} />
          </FormField>
          <FormField label="Chain (쉼표 구분)">
            <input type="text" value={chainsStr} onChange={(e) => setChainsStr(e.target.value)} placeholder="Ethereum, Arbitrum" />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Category">
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contract Vulnerability" />
          </FormField>
          <FormField label="Category2 (DeFi type)">
            <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Lending" />
          </FormField>
        </div>
        <FormField label="Summary">
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="사고 요약..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Pre-Incident Audit">
            <select value={preAuditStatus} onChange={(e) => setPreAuditStatus(e.target.value)}>
              <option value="null">미확인</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="rugged">Rugged</option>
            </select>
          </FormField>
          <FormField label="Post-Incident Audit">
            <select value={postAuditStatus} onChange={(e) => setPostAuditStatus(e.target.value)}>
              <option value="null">미확인</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="rugged">Rugged</option>
            </select>
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Compensation">
            <select value={compensationStatus} onChange={(e) => setCompensationStatus(e.target.value)}>
              <option value="null">미확인</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="rugged">Rugged</option>
            </select>
          </FormField>
          <FormField label="Postmortem">
            <select value={postmortemStatus} onChange={(e) => setPostmortemStatus(e.target.value)}>
              <option value="null">미확인</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="rugged">Rugged</option>
            </select>
          </FormField>
          <FormField label="LUMOS Score (0~100)">
            <input type="number" min={0} max={100} value={lumosScore} onChange={(e) => setLumosScore(e.target.value)} placeholder="75" />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Twitter (handle only)">
            <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="eulerfinance" />
          </FormField>
          <FormField label="Website">
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://euler.finance" />
          </FormField>
        </div>
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

function defaultTimeline(hackedAt: string): ScoreTimelineEntry[] {
  return [
    { label: 'Pre-Incident Audit', date: null, status: 'none' },
    { label: 'Hacked', date: hackedAt || null, status: hackedAt ? 'completed' : 'none' },
    { label: 'Post-Mortem Release', date: null, status: 'none' },
    { label: 'Community Compensation', date: null, status: 'none' },
    { label: 'Post-Incident Audit', date: null, status: 'none' },
  ];
}
