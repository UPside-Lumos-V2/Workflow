import { useState } from 'react';
import { Modal } from './shared';
import type { Case, CasePriority, CaseIncidentData } from '../types';
import { parseCaseFromText } from '../lib/gemini';
import { sendTelegramNotification } from '../lib/telegram';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function CreateCaseModal({ isOpen, onClose, onSubmit }: CreateCaseModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [chainsStr, setChainsStr] = useState('');
  const [amount, setAmount] = useState('');
  const [hackedAt, setHackedAt] = useState('');
  const [category, setCategory] = useState('');
  const [lumosScore, setLumosScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // AI 자동 채우기 상태
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const reset = () => {
    setTitle('');
    setPriority('medium');
    setDescription('');
    setSlug('');
    setChainsStr('');
    setAmount('');
    setHackedAt('');
    setCategory('');
    setLumosScore('');
    setAiInput('');
    setAiError('');
  };

  const handleAiFill = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const result = await parseCaseFromText(aiInput);
      if (result.title) setTitle(result.title);
      if (result.slug) setSlug(result.slug);
      if (result.chains?.length) setChainsStr(result.chains.join(', '));
      if (result.amount) setAmount(String(result.amount));
      if (result.hackedAt) setHackedAt(result.hackedAt);
      if (result.category) setCategory(result.category);
      if (result.description) setDescription(result.description);
      if (result.priority) setPriority(result.priority);
      if (result.lumosScore !== null) setLumosScore(String(result.lumosScore));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 파싱 실패');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const chains = chainsStr.split(',').map((s) => s.trim()).filter(Boolean);

      const incidentData: CaseIncidentData = {
        slug: slug.trim(),
        hackedAt: hackedAt || new Date().toISOString().slice(0, 10),
        chains,
        amount: parseInt(amount) || 0,
        category: category.trim() || 'Unknown',
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
        lumosScore: lumosScore ? parseInt(lumosScore) : null,
        scoreTimeline: [
          { label: 'Pre-Incident Audit', date: null, status: 'none' as const },
          { label: 'Hacked', date: hackedAt || null, status: hackedAt ? 'completed' as const : 'none' as const },
          { label: 'Post-Mortem Release', date: null, status: 'none' as const },
          { label: 'Community Compensation', date: null, status: 'none' as const },
          { label: 'Post-Incident Audit', date: null, status: 'none' as const },
        ],
      };

      await onSubmit({
        title: title.trim(),
        status: 'active',
        priority,
        description: description.trim(),
        metadata: { chain: chains[0] ?? '' },
        incidentData,
      });
      sendTelegramNotification(`🚨 *새 케이스:* "${title.trim()}"\nPriority: ${priority} | ${slug.trim() || 'N/A'} | ${chains.join(', ') || 'N/A'}`);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="새 케이스"
      actions={
        <>
          <button className="btn btn-secondary" onClick={handleClose}>취소</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting ? '생성 중...' : '생성'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
        {/* AI 자동 채우기 섹션 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(159,52,180,0.06), rgba(30,58,101,0.06))',
          border: '1px solid rgba(159,52,180,0.15)',
          borderRadius: 'var(--radius-md)',
          padding: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, color: '#9F34B4',
          }}>
            <span style={{ fontSize: 16 }}>✦</span> AI 자동 채우기
          </div>
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder={'사건 정보를 자유롭게 입력하세요.\n예: "CrossCurve 프로토콜이 이더리움에서 Flash Loan 공격으로 120만 달러 해킹당함. 2024년 3월 15일에 발생."'}
            rows={5}
            style={{ fontSize: 'var(--font-size-sm)', marginBottom: 8, width: '100%', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-sm"
              onClick={handleAiFill}
              disabled={!aiInput.trim() || aiLoading}
              style={{
                background: aiLoading ? 'var(--color-bg-tertiary)' : '#9F34B4',
                color: 'white', border: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {aiLoading ? (
                <>
                  <span style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                  }} />
                  분석 중...
                </>
              ) : '자동 채우기'}
            </button>
            {aiError && (
              <span style={{ color: '#EF4444', fontSize: 'var(--font-size-xs)' }}>{aiError}</span>
            )}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">제목 <span style={{ color: '#EF4444' }}>*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="CrossCurve Flash Loan Exploit"
            autoFocus
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">우선순위 <span style={{ color: '#EF4444' }}>*</span></label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="간단한 설명..."
            rows={2}
          />
        </div>

        {/* 사고 데이터 섹션 */}
        <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 4, color: '#9F34B4' }}>
            📊 사고 데이터 (pre-lumos)
          </div>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 8 }}>
            선택사항 — 나중에 케이스 수정에서 추가/변경 가능
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Slug</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="euler-finance-2023" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">피해금액 (USD)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="197000000" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">사고 일자</label>
            <input type="date" value={hackedAt} onChange={(e) => setHackedAt(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Chain (쉼표 구분)</label>
            <input type="text" value={chainsStr} onChange={(e) => setChainsStr(e.target.value)} placeholder="Ethereum, Arbitrum" />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Category</label>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contract Vulnerability" />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">LUMOS Score (0~100)</label>
          <input type="number" min={0} max={100} value={lumosScore} onChange={(e) => setLumosScore(e.target.value)} placeholder="75" />
        </div>
      </div>
    </Modal>
  );
}
