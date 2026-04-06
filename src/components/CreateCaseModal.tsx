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
  const [protocol, setProtocol] = useState('');
  const [chain, setChain] = useState('');
  const [hackedAmount, setHackedAmount] = useState('');
  const [hackedDate, setHackedDate] = useState('');
  const [attackVectorStr, setAttackVectorStr] = useState('');
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
    setProtocol('');
    setChain('');
    setHackedAmount('');
    setHackedDate('');
    setAttackVectorStr('');
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
      if (result.protocol) setProtocol(result.protocol);
      if (result.chain) setChain(result.chain);
      if (result.hackedAmount) setHackedAmount(String(result.hackedAmount));
      if (result.hackedDate) setHackedDate(result.hackedDate);
      if (result.attackVector.length > 0) setAttackVectorStr(result.attackVector.join(', '));
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
      const metadata: Record<string, string> = {};
      if (protocol.trim()) metadata.protocol = protocol.trim();
      if (chain.trim()) metadata.chain = chain.trim();

      const incidentData: CaseIncidentData = {
        hackedAmount: parseInt(hackedAmount) || 0,
        hackedDate: hackedDate || new Date().toISOString().slice(0, 10),
        chain: chain.trim(),
        protocol: protocol.trim(),
        attackVector: attackVectorStr.split(',').map((s) => s.trim()).filter(Boolean),
        incidentCode: '',
        lumosScore: lumosScore ? parseInt(lumosScore) : null,
        auditStatus: null,
        scoreTimeline: [
          { label: 'Pre-Incident Audit', date: null, status: 'none' as const },
          { label: 'Hacked', date: hackedDate || null, status: hackedDate ? 'completed' as const : 'none' as const },
          { label: 'Post-Mortem Release', date: null, status: 'none' as const },
          { label: 'Community Compensation', date: null, status: 'none' as const },
          { label: 'Post-Incident Audit', date: null, status: 'none' as const },
        ],
        fundDestination: null,
        auditHistory: null,
        summary: '',
      };

      await onSubmit({
        title: title.trim(),
        status: 'active',
        priority,
        description: description.trim(),
        metadata,
        incidentData,
      });
      // 텔레그램 알림
      sendTelegramNotification(`🚨 *새 케이스:* "${title.trim()}"\nPriority: ${priority} | ${protocol.trim() || 'N/A'} | ${chain.trim() || 'N/A'}`);
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
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: 8, color: '#9F34B4' }}>
            📊 사고 데이터
          </div>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 8 }}>
            선택사항 — 나중에 케이스 수정에서 추가/변경 가능
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Protocol <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="text" value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="CrossCurve" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Chain <span style={{ color: '#EF4444' }}>*</span></label>
            <input type="text" value={chain} onChange={(e) => setChain(e.target.value)} placeholder="Ethereum" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">피해금액 (USD)</label>
            <input type="number" value={hackedAmount} onChange={(e) => setHackedAmount(e.target.value)} placeholder="1200000" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">사고 일자</label>
            <input type="date" value={hackedDate} onChange={(e) => setHackedDate(e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Attack Vector (쉼표 구분)</label>
          <input type="text" value={attackVectorStr} onChange={(e) => setAttackVectorStr(e.target.value)} placeholder="Contract Vulnerability, Logic Bug" />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">LUMOS Score (0~100)</label>
          <input type="number" min={0} max={100} value={lumosScore} onChange={(e) => setLumosScore(e.target.value)} placeholder="75" />
        </div>
      </div>
    </Modal>
  );
}
