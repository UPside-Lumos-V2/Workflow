import { useState, useCallback, useRef } from 'react';
import type { PreLumosRow, PipelineState, ValidatorFinding } from '../types/preLumos';
import { INITIAL_PIPELINE_STATE } from '../types/preLumos';
import { runOrchestrator, parseAndValidateImportJson, registerRowsAsCases } from '../lib/preLumos';
import { useCases } from '../hooks/useStore';
import type { Case } from '../types';

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  idle: '대기',
  extracting: 'Phase 1-4: 사건 추출 + 정규화 중...',
  extracted: '사건 추출 완료',
  validating: 'Phase 5: 검증 Swarm 실행 중...',
  validated: '검증 완료',
  repairing: 'Phase 6: 수리 + 재검증 중...',
  repaired: '수리 완료',
  registering: 'Cases 등록 중...',
  complete: '등록 완료',
  error: '오류 발생',
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

const INPUT_PLACEHOLDER = `사건 정보를 입력하세요. 아래 필수 항목이 포함되어야 합니다:

★ 프로토콜 이름 (name) — 예: "Euler Finance"
★ 사고 날짜 (hackedAt) — 예: "2023-03-13"
★ 관련 체인 (chains) — 예: "Ethereum"
★ 피해 금액 (amount) — 예: "$197M"
★ 공격 유형 (category) — 예: "Flash Loan Attack"

선택: 감사이력, 보상여부, 자금흐름, Twitter, Website 등

복수 사건을 한 번에 입력할 수도 있습니다.`;

// ─────────────────────────────────────────────────────
// Utility: 금액 포맷
// ─────────────────────────────────────────────────────

function formatUsd(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

// ─────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────

export function AnalyzerPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'text' | 'json'>('text');

  // Path A state
  const [rawText, setRawText] = useState('');
  const [year, setYear] = useState(CURRENT_YEAR);

  // Path B state
  const [jsonInput, setJsonInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline state
  const [state, setState] = useState<PipelineState>(INITIAL_PIPELINE_STATE);
  const [finalRows, setFinalRows] = useState<PreLumosRow[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // Cases hook
  const { add: addCase } = useCases();

  // ── Pipeline state updater ──
  const updateState = useCallback((partial: Partial<PipelineState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── Path A: 분석 실행 ──
  const handleAnalyze = useCallback(async () => {
    if (!rawText.trim()) return;

    setState(INITIAL_PIPELINE_STATE);
    setFinalRows([]);
    setParseErrors([]);

    try {
      const result = await runOrchestrator(rawText, year, updateState);
      setFinalRows(result.finalRows);
      setSelectedSlugs(new Set(result.finalRows.map((r) => r.slug)));
      updateState({
        phase: result.finalRows.length > 0 ? 'validated' : 'error',
        exceptions: result.exceptions,
        error: result.finalRows.length === 0 ? 'No valid incidents produced.' : null,
      });
    } catch (err) {
      updateState({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [rawText, year, updateState]);

  // ── Path B: JSON 임포트 ──
  const handleJsonImport = useCallback(() => {
    if (!jsonInput.trim()) return;

    setState(INITIAL_PIPELINE_STATE);
    setParseErrors([]);

    const { rows, errors } = parseAndValidateImportJson(jsonInput);
    setParseErrors(errors);

    if (rows.length > 0) {
      setFinalRows(rows);
      setSelectedSlugs(new Set(rows.map((r) => r.slug)));
      updateState({ phase: 'validated', rows });
    } else {
      updateState({ phase: 'error', error: '유효한 사건 데이터를 찾을 수 없습니다.' });
    }
  }, [jsonInput, updateState]);

  // ── Path B: 파일 업로드 ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonInput(text);
    };
    reader.readAsText(file);
  }, []);

  // ── 선택 토글 ──
  const toggleSlug = useCallback((slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  // ── Cases 등록 ──
  const handleRegister = useCallback(async () => {
    const toRegister = finalRows.filter((r) => selectedSlugs.has(r.slug));
    if (toRegister.length === 0) return;

    updateState({ phase: 'registering' });

    const { registered, failed } = await registerRowsAsCases(
      toRegister,
      async (input) => {
        const result = await addCase(input as Omit<Case, 'id' | 'createdAt' | 'updatedAt'>);
        return result ? { id: result.id } : null;
      },
    );

    updateState({
      phase: 'complete',
      registeredSlugs: registered,
      exceptions: failed,
    });
  }, [finalRows, selectedSlugs, addCase, updateState]);

  // ── Phase badge color ──
  const phaseColor = (() => {
    if (state.phase === 'error') return 'var(--color-danger, #ef4444)';
    if (state.phase === 'complete') return 'var(--color-success, #22c55e)';
    if (['extracting', 'validating', 'repairing', 'registering'].includes(state.phase))
      return 'var(--color-warning, #f59e0b)';
    return 'var(--color-primary, #6366f1)';
  })();

  const isProcessing = ['extracting', 'validating', 'repairing', 'registering'].includes(state.phase);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>사건 분석기</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: 14 }}>
        pre-lumos 스킬 파이프라인으로 보안 사건 데이터를 분석하고 Cases에 등록합니다.
      </p>

      {/* ── 탭 헤더 ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
        <TabButton active={activeTab === 'text'} onClick={() => setActiveTab('text')}>
          📝 텍스트 분석
        </TabButton>
        <TabButton active={activeTab === 'json'} onClick={() => setActiveTab('json')}>
          📁 JSON 임포트
        </TabButton>
      </div>

      {/* ── Tab A: 텍스트 분석 ── */}
      {activeTab === 'text' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>연도:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 13,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={INPUT_PLACEHOLDER}
            style={{
              width: '100%', minHeight: 280, padding: 16, borderRadius: 8, fontSize: 13,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.6,
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={!rawText.trim() || isProcessing}
            style={{ marginTop: 12, padding: '10px 24px' }}
          >
            {isProcessing ? '분석 중...' : '🔍 분석 실행'}
          </button>
        </div>
      )}

      {/* ── Tab B: JSON 임포트 ── */}
      {activeTab === 'json' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            로컬 에이전트로 <code>skills-pre-lumos</code> 실행 후 생성된 <code>seed/import_&#123;YEAR&#125;.json</code>을
            업로드하거나 붙여넣으세요. (검증 생략 — 에이전트가 이미 완료)
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: 13 }}
            >
              📂 파일 업로드
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[ { "name": "...", "slug": "...", ... } ]'
            style={{
              width: '100%', minHeight: 200, padding: 16, borderRadius: 8, fontSize: 12,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontFamily: 'monospace', resize: 'vertical',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleJsonImport}
            disabled={!jsonInput.trim() || isProcessing}
            style={{ marginTop: 12, padding: '10px 24px' }}
          >
            📥 임포트
          </button>
        </div>
      )}

      {/* ── 공통: 진행 상태 ── */}
      {state.phase !== 'idle' && (
        <div style={{
          marginTop: 24, padding: 16, borderRadius: 8,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: phaseColor,
              animation: isProcessing ? 'pulse 1.5s ease infinite' : 'none',
            }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {PHASE_LABELS[state.phase] || state.phase}
            </span>
          </div>

          {/* 에러 표시 */}
          {state.error && (
            <div style={{
              padding: 12, borderRadius: 6, fontSize: 13,
              background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger, #ef4444)',
              marginBottom: 12,
            }}>
              ❌ {state.error}
            </div>
          )}

          {/* 구조 에러 (Path B) */}
          {parseErrors.length > 0 && (
            <div style={{
              padding: 12, borderRadius: 6, fontSize: 13,
              background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning, #d97706)',
              marginBottom: 12, maxHeight: 120, overflow: 'auto',
            }}>
              ⚠️ 구조 확인 결과:
              {parseErrors.map((e, i) => <div key={i} style={{ marginTop: 4 }}>• {e}</div>)}
            </div>
          )}

          {/* 검증 결과 (Path A만) */}
          {state.contractResult && state.ruleResult && activeTab === 'text' && (
            <ValidationReport
              contractResult={state.contractResult}
              ruleResult={state.ruleResult}
            />
          )}
        </div>
      )}

      {/* ── 공통: 미리보기 카드 ── */}
      {finalRows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>
              미리보기 ({finalRows.length}건)
            </h2>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedSlugs.size === finalRows.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedSlugs(new Set(finalRows.map((r) => r.slug)));
                  else setSelectedSlugs(new Set());
                }}
              />
              전체 선택
            </label>
          </div>

          {finalRows.map((row) => (
            <IncidentCard
              key={row.slug}
              row={row}
              selected={selectedSlugs.has(row.slug)}
              onToggle={() => toggleSlug(row.slug)}
            />
          ))}

          {/* 등록 버튼 */}
          {state.phase !== 'complete' && (
            <button
              className="btn btn-primary"
              onClick={handleRegister}
              disabled={selectedSlugs.size === 0 || isProcessing}
              style={{ marginTop: 16, padding: '12px 32px', fontSize: 15, fontWeight: 600 }}
            >
              📋 선택한 {selectedSlugs.size}건 Cases에 등록
            </button>
          )}
        </div>
      )}

      {/* ── 등록 완료 ── */}
      {state.phase === 'complete' && (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 8,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--color-success, #22c55e)', marginBottom: 8 }}>
            ✅ 등록 완료
          </div>
          {state.registeredSlugs.length > 0 && (
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              성공: {state.registeredSlugs.join(', ')}
            </div>
          )}
          {state.exceptions.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)' }}>
              실패: {state.exceptions.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px', fontSize: 14, fontWeight: active ? 600 : 400,
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: active ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

function IncidentCard({ row, selected, onToggle }: {
  row: PreLumosRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      padding: 16, borderRadius: 8, marginBottom: 8,
      border: `1px solid ${selected ? 'var(--color-primary, #6366f1)' : 'var(--color-border)'}`,
      background: selected ? 'rgba(99,102,241,0.04)' : 'var(--color-surface)',
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {row.slug} · {row.hackedAt} · {row.chains.join(', ')} · {formatUsd(row.amount)}
          </div>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary, #6366f1)',
        }}>
          {row.category}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)',
          fontSize: 12, lineHeight: 1.8,
        }}>
          {row.summary && <div><b>요약:</b> {row.summary}</div>}
          <div><b>보상:</b> {row.compensationStatus || 'N/A'}</div>
          <div><b>사전감사:</b> {row.preIncidentAuditStatus || 'N/A'} ({row.preAudits?.length || 0}건)</div>
          <div><b>사후감사:</b> {row.postIncidentAuditStatus || 'N/A'} ({row.postAudits?.length || 0}건)</div>
          <div><b>포스트모템:</b> {row.postmortemStatus || 'N/A'}</div>
          {row.twitter && <div><b>Twitter:</b> @{row.twitter}</div>}
          {row.website && <div><b>Website:</b> {row.website}</div>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Raw JSON</summary>
            <pre style={{
              padding: 8, borderRadius: 4, fontSize: 11, overflow: 'auto', maxHeight: 300,
              background: 'rgba(0,0,0,0.03)', marginTop: 4,
            }}>
              {JSON.stringify(row, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ValidationReport({ contractResult, ruleResult }: {
  contractResult: { status: string; findings: ValidatorFinding[] };
  ruleResult: { status: string; findings: ValidatorFinding[] };
}) {
  const allFindings = [...contractResult.findings, ...ruleResult.findings];
  const passed = allFindings.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: contractResult.status === 'pass' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: contractResult.status === 'pass' ? '#22c55e' : '#ef4444',
        }}>
          Contract: {contractResult.status.toUpperCase()}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: ruleResult.status === 'pass' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: ruleResult.status === 'pass' ? '#22c55e' : '#ef4444',
        }}>
          Rule: {ruleResult.status.toUpperCase()}
        </span>
      </div>

      {!passed && (
        <div style={{ fontSize: 12, maxHeight: 160, overflow: 'auto' }}>
          {allFindings.map((f, i) => (
            <div key={i} style={{
              padding: '4px 0', display: 'flex', gap: 8,
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, width: 56, textAlign: 'center',
                borderRadius: 3, padding: '0 4px',
                background: f.severity === 'blocker' ? 'rgba(239,68,68,0.1)' :
                  f.severity === 'repairable' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)',
                color: f.severity === 'blocker' ? '#ef4444' :
                  f.severity === 'repairable' ? '#d97706' : '#64748b',
              }}>
                {f.severity}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, width: 80 }}>{f.ruleId}</span>
              <span style={{ flex: 1 }}>{f.problem}</span>
            </div>
          ))}
        </div>
      )}

      {passed && (
        <div style={{ fontSize: 13, color: 'var(--color-success, #22c55e)' }}>
          ✅ 모든 검증을 통과했습니다.
        </div>
      )}
    </div>
  );
}
