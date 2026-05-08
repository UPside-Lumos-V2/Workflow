import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 100;
const RED = '#DC2626';
const RED_BG = '#FEF2F2';
const RED_BORDER = '#FECACA';
const ACTIVE_INCIDENT_TERMS = [
  'exploited', 'was exploited', 'has been exploited', 'reportedly exploited',
  'was attacked', 'being attacked', 'suspicious attack', 'critical exploit',
  'reentrancy hack', 'compromised admin key', 'missing access control',
  'drained', 'drain all funds', 'stolen funds', 'attacker exploited',
  'funds at risk', 'security breach',
];
const OTHER_CONTEXT_TERMS = [
  'onchain message', 'bounty', 'returned', 'whitehat', 'funds are safu',
  'fund return', 'refund', 'negotiation', 'laundered', 'tornado cash',
  'monthly', 'weekly', 'security news', 'web2 security', 'newsletter', 'report', 'post-mortem',
  'retrospective', 'case study', 'educational', 'partnered', 'staking',
  'staked', 'etf', 'whale', 'deposited', 'withdrew', 'airdrop',
];

interface HackSignal {
  id: string;
  raw_text: string;
  source: string;
  source_id: string;
  source_url: string;
  source_author: string;
  source_author_tier: number;
  published_at: string;
  crawled_at: string;
  protocol_name: string | null;
  chain: string | null;
  loss_usd: number | null;
  tx_hash: string | null;
  attacker_address: string | null;
  has_hack_keyword: boolean;
  media_urls: string[];
  incident_group_id?: string | null;
  confidence_score?: number | null;
  alert_status?: string | null;
  llm_is_hack?: boolean | null;
  llm_confidence?: number | null;
  llm_category?: string | null;
  llm_summary?: string | null;
  triage_status?: TriageStatus | null;
  operator_note?: string | null;
  linked_case_id?: string | null;
}

interface SkippedMessage {
  id: string;
  skip_reason: string;
  source: string;
  channel_name: string;
  channel_id: number | null;
  message_id: number | null;
  raw_text: string | null;
  skipped_at: string;
}

type TabType = 'signals' | 'skipped';
type FilterType = 'all' | 'hack' | 'normal';
type SortType = 'newest' | 'confidence' | 'loss';
type SourceFilterType = 'all' | 'twitter' | 'telegram';
type TriageStatus = 'reviewed' | 'false_positive' | 'escalated' | 'ambiguous' | 'quarantined';
type SectionKey = 'incident' | 'review' | 'normal';

interface IncidentGroupView {
  key: string;
  groupId: string | null;
  protocolName: string | null;
  chain: string | null;
  topLoss: number | null;
  sourceCount: number;
  latestPublishedAt: string;
  topTier: number;
  maxConfidence: number | null;
  members: HackSignal[];
}

interface ExactCounts {
  total: number | null;
  hack: number | null;
  skipped: number | null;
  escalated: number | null;
}

const TRIAGE_LABELS: Record<TriageStatus, string> = {
  reviewed: '검토완료',
  false_positive: '오탐',
  escalated: 'Escalated',
  ambiguous: '애매',
  quarantined: '격리',
};

// ── Helpers ──
function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function truncateHash(hash: string, len = 10): string {
  if (hash.length <= len * 2) return hash;
  return `${hash.slice(0, len)}...${hash.slice(-6)}`;
}

function normalizeConfidence(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (value <= 1) return Math.max(0, value);
  return Math.min(value / 100, 1);
}

function formatConfidence(value: number): string {
  return `${Math.round((normalizeConfidence(value) ?? 0) * 100)}%`;
}

function signalText(s: HackSignal): string {
  return `${s.source_author ?? ''}\n${s.raw_text ?? ''}\n${s.llm_summary ?? ''}`.toLowerCase();
}

function hasOtherContext(s: HackSignal): boolean {
  const text = signalText(s);
  return OTHER_CONTEXT_TERMS.some((term) => text.includes(term));
}

function hasActiveIncidentLanguage(s: HackSignal): boolean {
  const text = signalText(s);
  return ACTIVE_INCIDENT_TERMS.some((term) => text.includes(term));
}

function hasIncidentEvidence(s: HackSignal): boolean {
  return Boolean(s.protocol_name || s.tx_hash || s.attacker_address || s.loss_usd);
}

function isHackSignal(s: HackSignal): boolean {
  return isActionableHackIncident(s);
}

function isActionableHackIncident(s: HackSignal): boolean {
  if (s.llm_is_hack === false) return false;
  if (hasOtherContext(s)) return false;
  if (s.llm_is_hack === true && hasActiveIncidentLanguage(s)) return hasIncidentEvidence(s);
  if (hasActiveIncidentLanguage(s) && hasIncidentEvidence(s)) return true;
  return false;
}

function needsHackReview(s: HackSignal): boolean {
  if (s.llm_is_hack === false) return false;
  if (hasOtherContext(s)) return false;
  return s.llm_is_hack === true || s.has_hack_keyword || s.alert_status === 'ambiguous' || s.alert_status === 'quarantined';
}

function getWhyFlagged(signal: HackSignal): string[] {
  const reasons: string[] = [];
  if (signal.llm_is_hack === true) reasons.push(`LLM hack 판정${signal.llm_category ? ` (${signal.llm_category})` : ''}`);
  if (signal.has_hack_keyword) reasons.push('해킹 키워드 감지');
  if (signal.alert_status === 'alerted' || signal.alert_status === 'follow_up') reasons.push(`alert_status=${signal.alert_status}`);
  if (signal.alert_status === 'ambiguous' || signal.alert_status === 'quarantined') reasons.push(`alert_status=${signal.alert_status}`);
  if (signal.source_author_tier === 1) reasons.push('Tier 1 소스');
  if (signal.tx_hash) reasons.push('트랜잭션 해시 추출됨');
  if (signal.loss_usd != null) reasons.push('피해액 추출됨');
  return reasons.length ? reasons : ['명확한 hack 근거 없음 — 원문 검토 필요'];
}

function buildTraceExpCandidate(signal: HackSignal) {
  return {
    incident_group_id: signal.incident_group_id ?? null,
    protocol_name: signal.protocol_name,
    chain: signal.chain,
    tx_hash: signal.tx_hash,
    loss_usd: signal.loss_usd,
    attacker_address: signal.attacker_address,
    confidence_score: signal.confidence_score ?? null,
    source_url: signal.source_url,
    source_author: signal.source_author,
    published_at: signal.published_at,
    readiness: signal.tx_hash && signal.chain ? 'ready' : signal.tx_hash ? 'needs_chain_normalization' : 'needs_tx_verify',
  };
}

// 신호를 3개 섹션으로 분류: 운영자 triage 우선, 그다음 alert_status.
function classifySection(s: HackSignal): SectionKey {
  if (s.triage_status === 'false_positive') return 'normal';
  if (s.triage_status === 'escalated' || s.triage_status === 'reviewed') return 'incident';
  if (s.triage_status === 'ambiguous' || s.triage_status === 'quarantined') return 'review';
  if (isActionableHackIncident(s)) return 'incident';
  if (needsHackReview(s)) return 'review';
  return 'normal';
}

function buildIncidentGroups(signals: HackSignal[]): IncidentGroupView[] {
  const groups = new Map<string, IncidentGroupView>();
  for (const s of signals) {
    const key = s.incident_group_id ?? `solo:${s.id}`;
    const conf = s.llm_confidence ?? s.confidence_score ?? null;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        groupId: s.incident_group_id ?? null,
        protocolName: s.protocol_name,
        chain: s.chain,
        topLoss: s.loss_usd ?? null,
        sourceCount: 1,
        latestPublishedAt: s.published_at,
        topTier: s.source_author_tier,
        maxConfidence: conf,
        members: [s],
      });
    } else {
      existing.members.push(s);
      existing.sourceCount += 1;
      existing.protocolName = existing.protocolName ?? s.protocol_name;
      existing.chain = existing.chain ?? s.chain;
      if (s.loss_usd != null && (existing.topLoss == null || s.loss_usd > existing.topLoss)) {
        existing.topLoss = s.loss_usd;
      }
      if (s.published_at > existing.latestPublishedAt) {
        existing.latestPublishedAt = s.published_at;
      }
      if (s.source_author_tier < existing.topTier) {
        existing.topTier = s.source_author_tier;
      }
      if (conf != null && (existing.maxConfidence == null || conf > existing.maxConfidence)) {
        existing.maxConfidence = conf;
      }
    }
  }
  for (const g of groups.values()) {
    g.members.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  }
  return Array.from(groups.values());
}

function sortIncidents(arr: IncidentGroupView[], sortBy: SortType): IncidentGroupView[] {
  return [...arr].sort((a, b) => {
    if (sortBy === 'confidence') return (b.maxConfidence ?? -1) - (a.maxConfidence ?? -1);
    if (sortBy === 'loss') return (b.topLoss ?? -1) - (a.topLoss ?? -1);
    return new Date(b.latestPublishedAt).getTime() - new Date(a.latestPublishedAt).getTime();
  });
}

function sortSignals(arr: HackSignal[], sortBy: SortType): HackSignal[] {
  return [...arr].sort((a, b) => {
    if (sortBy === 'confidence') {
      const ac = a.llm_confidence ?? a.confidence_score ?? -1;
      const bc = b.llm_confidence ?? b.confidence_score ?? -1;
      return bc - ac;
    }
    if (sortBy === 'loss') return (b.loss_usd ?? -1) - (a.loss_usd ?? -1);
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
}

// ── Reusable subcomponents ──
function MetadataChips({ signal }: { signal: HackSignal }) {
  const chips: ReactNode[] = [];
  if (signal.loss_usd != null) {
    chips.push(<span key="loss" style={{ fontWeight: 700, color: RED }}>{formatUsd(signal.loss_usd)}</span>);
  }
  if (signal.protocol_name) {
    chips.push(<span key="protocol" style={{ fontWeight: 600 }}>{signal.protocol_name}</span>);
  }
  if (signal.chain) {
    chips.push(<span key="chain" style={{ textTransform: 'capitalize' }}>{signal.chain}</span>);
  }
  if (signal.tx_hash) {
    chips.push(
      <span key="tx" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {truncateHash(signal.tx_hash)}
      </span>
    );
  }
  if (chips.length === 0) return null;
  return (
    <div style={{
      fontSize: 12, color: 'var(--color-text-secondary)',
      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
    }}>
      {chips.map((chip, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: 'var(--color-border)', fontSize: 10 }}>·</span>}
          {chip}
        </span>
      ))}
    </div>
  );
}

function MetadataCell({
  label, value, missing, wide = false, monospace = false,
}: {
  label: string;
  value: ReactNode;
  missing: boolean;
  wide?: boolean;
  monospace?: boolean;
}) {
  return (
    <div style={{ gridColumn: wide ? 'span 2' : undefined, minWidth: 0 }}>
      <span className="text-tertiary" style={{ fontSize: 11 }}>{label}</span>
      <div style={{
        marginTop: 3, minHeight: 20,
        fontSize: monospace ? 12 : 13,
        fontFamily: monospace ? 'var(--font-mono)' : undefined,
        fontWeight: missing ? 400 : 600,
        color: missing ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        wordBreak: 'break-all',
      }}>
        {missing ? '—' : value}
      </div>
    </div>
  );
}

function SignalDetail({
  signal, triageStatus, operatorNote, onTriageChange, onNoteChange, onClose,
}: {
  signal: HackSignal;
  triageStatus?: TriageStatus;
  operatorNote: string;
  onTriageChange: (status: TriageStatus) => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
}) {
  const hack = isHackSignal(signal);
  const rawJson = JSON.stringify(signal, null, 2);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const whyFlagged = getWhyFlagged(signal);

  const copyTraceExpCandidate = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildTraceExpCandidate(signal), null, 2));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{
        maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto',
        padding: 24,
        borderLeft: hack ? `4px solid ${RED}` : undefined,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {hack && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px',
                  borderRadius: 4, background: RED, color: '#fff',
                  letterSpacing: '0.05em',
                }}>HACK</span>
              )}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{signal.source_author}</h3>
            </div>
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              {signal.source === 'twitter' ? 'Twitter' : 'Telegram'} · Tier {signal.source_author_tier} · {new Date(signal.published_at).toLocaleString('ko-KR')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {signal.source_url && (
              <a
                href={signal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, textDecoration: 'none', color: 'var(--color-status-open)' }}
                onClick={(e) => e.stopPropagation()}
              >
                원본 보기 ↗
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{
          marginBottom: 16, padding: 12,
          background: hack ? RED_BG : 'var(--color-bg-secondary)',
          borderRadius: 8,
          border: hack ? `1px solid ${RED_BORDER}` : '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>왜 탐지됐나</div>
              <div className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                {whyFlagged.join(' · ')}
              </div>
            </div>
            {signal.llm_confidence != null && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="text-tertiary" style={{ fontSize: 11 }}>LLM confidence</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{formatConfidence(signal.llm_confidence)}</div>
              </div>
            )}
          </div>
          {signal.llm_summary && (
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>{signal.llm_summary}</div>
          )}
        </div>

        <div style={{
          marginBottom: 16, padding: 12,
          background: 'var(--color-bg-secondary)', borderRadius: 8,
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {([
              ['reviewed', '검토완료'],
              ['false_positive', '오탐'],
              ['escalated', 'Escalate'],
            ] as const).map(([status, label]) => (
              <button
                key={status}
                className={`btn btn-sm ${triageStatus === status ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onTriageChange(status)}
              >
                {label}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={copyTraceExpCandidate} disabled={!signal.tx_hash}>
              TraceExp 후보 복사
            </button>
            {copyState !== 'idle' && (
              <span className="text-tertiary" style={{ fontSize: 12 }}>
                {copyState === 'copied' ? '복사됨' : '복사 실패'}
              </span>
            )}
          </div>
          <textarea
            value={operatorNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="운영자 메모: 확인한 내용, 다음 액션, TraceExp 실행 필요 여부"
            style={{
              width: '100%', minHeight: 70,
              border: '1px solid var(--color-border)',
              borderRadius: 8, padding: 10,
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
          marginBottom: 16, padding: 12,
          background: 'var(--color-bg-secondary)', borderRadius: 8,
        }}>
          <MetadataCell label="Protocol" value={signal.protocol_name} missing={!signal.protocol_name} />
          <MetadataCell label="Chain" value={signal.chain} missing={!signal.chain} />
          <MetadataCell label="Loss" value={signal.loss_usd != null ? formatUsd(signal.loss_usd) : null} missing={signal.loss_usd == null} />
          <MetadataCell label="Confidence" value={signal.confidence_score != null ? String(signal.confidence_score) : null} missing={signal.confidence_score == null} />
          <MetadataCell label="Tx Hash" value={signal.tx_hash ? truncateHash(signal.tx_hash, 16) : null} missing={!signal.tx_hash} wide monospace />
          <MetadataCell label="Attacker" value={signal.attacker_address} missing={!signal.attacker_address} wide monospace />
          <MetadataCell label="Incident Group" value={signal.incident_group_id} missing={!signal.incident_group_id} wide monospace />
        </div>

        <div style={{ marginBottom: 16 }}>
          <span className="text-tertiary" style={{ fontSize: 11 }}>원문 (raw_text)</span>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            fontSize: 13, lineHeight: 1.6, padding: 12,
            background: 'var(--color-bg-secondary)', borderRadius: 8,
            marginTop: 4, maxHeight: 300, overflow: 'auto',
          }}>
            {signal.raw_text}
          </pre>
        </div>

        <details>
          <summary className="text-tertiary" style={{ fontSize: 12, cursor: 'pointer' }}>
            Raw signal JSON
          </summary>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            fontSize: 12, lineHeight: 1.5, padding: 12,
            background: 'var(--color-bg-secondary)', borderRadius: 8,
            marginTop: 8, maxHeight: 260, overflow: 'auto',
          }}>
            {rawJson}
          </pre>
        </details>
      </div>
    </div>
  );
}

// ── Section presentation ──
function SectionHeader({ title, count, accent, hint }: {
  title: string;
  count: number;
  accent: 'red' | 'amber' | 'gray';
  hint?: string;
}) {
  const dot = accent === 'red' ? RED
    : accent === 'amber' ? 'var(--color-status-in-progress)'
    : 'var(--color-text-tertiary)';
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10,
      padding: '0 2px 12px',
      borderBottom: '1px solid var(--color-border-light)',
      marginBottom: 14,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: dot, alignSelf: 'center',
      }} />
      <h2 style={{
        fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
        color: 'var(--color-text-primary)',
      }}>{title}</h2>
      <span className="text-tertiary" style={{ fontSize: 12, fontWeight: 600 }}>{count}</span>
      {hint && (
        <span className="text-tertiary" style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, muted }: {
  label: string;
  value: number;
  accent?: 'red' | 'amber';
  muted?: boolean;
}) {
  const valueColor = accent === 'red' ? RED
    : accent === 'amber' ? 'var(--color-status-in-progress)'
    : muted ? 'var(--color-text-tertiary)'
    : 'var(--color-text-primary)';
  const borderLeft = accent === 'red' ? `3px solid ${RED}`
    : accent === 'amber' ? '3px solid var(--color-status-in-progress)'
    : undefined;
  return (
    <div className="card" style={{
      padding: '16px 18px',
      borderLeft,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div className="text-tertiary" style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>{label}</div>
      <div style={{
        fontSize: 24, fontWeight: 800,
        color: valueColor, letterSpacing: '-0.02em', lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function IncidentCard({ group, expanded, onToggle, onSignalClick }: {
  group: IncidentGroupView;
  expanded: boolean;
  onToggle: () => void;
  onSignalClick: (s: HackSignal) => void;
}) {
  const showExpand = group.members.length > 1;
  const primary = group.members[0];
  const handleCardClick = () => {
    if (showExpand) onToggle();
    else onSignalClick(primary);
  };

  return (
    <div
      className="card"
      style={{
        borderLeft: `4px solid ${RED}`,
        background: RED_BG,
        borderColor: RED_BORDER,
        padding: '20px 22px',
        cursor: 'pointer',
      }}
      onClick={handleCardClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px',
              borderRadius: 4, background: RED, color: '#fff',
              letterSpacing: '0.05em', flexShrink: 0,
            }}>HACK</span>
            <h3 style={{
              fontSize: 18, fontWeight: 800,
              letterSpacing: '-0.015em', margin: 0,
              color: 'var(--color-text-primary)',
            }}>
              {group.protocolName ?? (
                <span className="text-tertiary" style={{ fontWeight: 600 }}>Unknown protocol</span>
              )}
            </h3>
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            alignItems: 'center', fontSize: 13, lineHeight: 1.5,
          }}>
            {group.chain && (
              <span style={{
                fontWeight: 600, color: 'var(--color-text-primary)',
                textTransform: 'capitalize',
              }}>{group.chain}</span>
            )}
            {group.topLoss != null && (
              <>
                {group.chain && <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>}
                <span style={{ fontWeight: 800, color: RED, fontSize: 14 }}>
                  {formatUsd(group.topLoss)}
                </span>
              </>
            )}
            <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
            <span className="text-secondary" style={{ fontSize: 12 }}>
              소스 {group.sourceCount}
            </span>
            <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
            <span className="text-secondary" style={{ fontSize: 12 }}>
              Tier {group.topTier}
            </span>
            <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              {timeAgo(group.latestPublishedAt)}
            </span>
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', gap: 6, flexShrink: 0,
        }}>
          {group.maxConfidence != null && (
            <div style={{ textAlign: 'right' }}>
              <div className="text-tertiary" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
                CONFIDENCE
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800,
                color: 'var(--color-text-primary)', lineHeight: 1.1,
              }}>
                {formatConfidence(group.maxConfidence)}
              </div>
            </div>
          )}
          {showExpand && (
            <span className="text-secondary" style={{
              fontSize: 12, fontWeight: 600,
              padding: '4px 8px',
              background: 'var(--color-bg)',
              border: `1px solid ${RED_BORDER}`,
              borderRadius: 'var(--radius-sm)',
            }}>
              {expanded ? '▾ 접기' : `▸ 신호 ${group.sourceCount}개`}
            </span>
          )}
        </div>
      </div>

      {!expanded && (
        <p style={{
          fontSize: 13, color: 'var(--color-text-secondary)',
          lineHeight: 1.55, margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {primary.llm_summary ?? primary.raw_text}
        </p>
      )}

      {expanded && showExpand && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${RED_BORDER}`,
        }}>
          {group.members.map((m) => (
            <div
              key={m.id}
              onClick={(e) => { e.stopPropagation(); onSignalClick(m); }}
              style={{
                cursor: 'pointer',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                gap: 8, marginBottom: 4, alignItems: 'center',
              }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.source_author}</span>
                  <span className="text-tertiary" style={{ fontSize: 11 }}>
                    · Tier {m.source_author_tier} · {m.source === 'twitter' ? 'Twitter' : 'Telegram'}
                  </span>
                </div>
                <span className="text-tertiary" style={{ fontSize: 11, flexShrink: 0 }}>
                  {timeAgo(m.published_at)}
                </span>
              </div>
              <p style={{
                fontSize: 12, color: 'var(--color-text-secondary)',
                lineHeight: 1.5, margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>{m.raw_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ signal, onClick }: { signal: HackSignal; onClick: () => void }) {
  const reasonChip = signal.alert_status === 'quarantined' ? 'quarantined'
    : signal.alert_status === 'ambiguous' ? 'ambiguous'
    : signal.triage_status === 'ambiguous' ? 'ambiguous'
    : signal.triage_status === 'quarantined' ? 'quarantined'
    : null;
  const conf = signal.llm_confidence ?? signal.confidence_score ?? null;

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        borderLeft: '3px solid var(--color-status-in-progress)',
        padding: '14px 18px',
      }}
      onClick={onClick}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        gap: 8, marginBottom: 6, alignItems: 'center',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flexWrap: 'wrap', minWidth: 0,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '2px 7px', borderRadius: 4,
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-status-in-progress)',
            letterSpacing: '0.04em',
          }}>검토 필요</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {signal.protocol_name ?? signal.source_author}
          </span>
          <span className="text-tertiary" style={{ fontSize: 11 }}>
            {signal.protocol_name && `${signal.source_author} · `}
            Tier {signal.source_author_tier} · {signal.source === 'twitter' ? 'Twitter' : 'Telegram'}
          </span>
          {reasonChip && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: '2px 6px', borderRadius: 4,
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>{reasonChip}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {conf != null && (
            <span className="text-secondary" style={{ fontSize: 11, fontWeight: 600 }}>
              {formatConfidence(conf)}
            </span>
          )}
          <span className="text-tertiary" style={{ fontSize: 11 }}>{timeAgo(signal.published_at)}</span>
        </div>
      </div>
      <p style={{
        fontSize: 13, color: 'var(--color-text-secondary)',
        lineHeight: 1.5, margin: '0 0 8px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{signal.llm_summary ?? signal.raw_text}</p>
      <MetadataChips signal={signal} />
    </div>
  );
}

function NormalRow({ signal, onClick }: { signal: HackSignal; onClick: () => void }) {
  const triageStatus = signal.triage_status;
  return (
    <div
      className="card"
      style={{ cursor: 'pointer', padding: '12px 16px' }}
      onClick={onClick}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 10, marginBottom: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          minWidth: 0, flex: 1, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{signal.source_author}</span>
          <span className="text-tertiary" style={{ fontSize: 11 }}>
            · Tier {signal.source_author_tier} · {signal.source === 'twitter' ? 'Twitter' : 'Telegram'}
          </span>
          {triageStatus && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
            }}>{TRIAGE_LABELS[triageStatus]}</span>
          )}
        </div>
        <span className="text-tertiary" style={{ fontSize: 11, flexShrink: 0 }}>
          {timeAgo(signal.published_at)}
        </span>
      </div>
      <p style={{
        fontSize: 12, color: 'var(--color-text-secondary)',
        lineHeight: 1.5, margin: 0,
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{signal.raw_text}</p>
    </div>
  );
}

function LoadMoreButton({ onClick, loading, hasMore }: {
  onClick: () => void;
  loading: boolean;
  hasMore: boolean;
}) {
  if (!hasMore) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 8 }}>
      <button
        className="btn btn-secondary"
        onClick={onClick}
        disabled={loading}
        style={{ minWidth: 140 }}
      >
        {loading ? '로딩 중...' : '더 보기'}
      </button>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div style={{
      padding: '24px 16px',
      textAlign: 'center',
      color: 'var(--color-text-tertiary)',
      fontSize: 13,
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-md)',
      border: '1px dashed var(--color-border)',
    }}>
      {message}
    </div>
  );
}

// ── Main Page ──
export function HackSignalsPage() {
  const [tab, setTab] = useState<TabType>('signals');
  const [signals, setSignals] = useState<HackSignal[]>([]);
  const [skipped, setSkipped] = useState<SkippedMessage[]>([]);
  const [exactCounts, setExactCounts] = useState<ExactCounts>({
    total: null,
    hack: null,
    skipped: null,
    escalated: null,
  });
  const [signalsPage, setSignalsPage] = useState(0);
  const [skippedPage, setSkippedPage] = useState(0);
  const [signalsHasMore, setSignalsHasMore] = useState(true);
  const [skippedHasMore, setSkippedHasMore] = useState(true);
  const [loadingMoreSignals, setLoadingMoreSignals] = useState(false);
  const [loadingMoreSkipped, setLoadingMoreSkipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState<HackSignal | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');
  const [expandedIncidents, setExpandedIncidents] = useState<Set<string>>(new Set());

  const updateSignal = useCallback((id: string, patch: Partial<HackSignal>) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setSelectedSignal((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const fetchExactCounts = useCallback(async (): Promise<void> => {
    if (!supabase) return;

    const [total, allSignals, skippedCount, escalated] = await Promise.all([
      supabase.from('lumos_hack_signals').select('id', { count: 'exact', head: true }),
      supabase
        .from('lumos_hack_signals')
        .select('raw_text,llm_summary,llm_is_hack,has_hack_keyword,alert_status,triage_status,protocol_name,tx_hash,attacker_address,loss_usd')
        .range(0, 999),
      supabase.from('lumos_skipped_messages').select('id', { count: 'exact', head: true }),
      supabase
        .from('lumos_hack_signals')
        .select('id', { count: 'exact', head: true })
        .eq('triage_status', 'escalated'),
    ]);

    if (total.error || allSignals.error || skippedCount.error || escalated.error) {
      console.error('Fetch hack signal counts error:', {
        total: total.error,
        allSignals: allSignals.error,
        skipped: skippedCount.error,
        escalated: escalated.error,
      });
      return;
    }

    setExactCounts({
      total: total.count,
      hack: ((allSignals.data ?? []) as HackSignal[]).filter(isActionableHackIncident).length,
      skipped: skippedCount.count,
      escalated: escalated.count,
    });
  }, []);

  const updateTriage = useCallback(
    async (id: string, patch: Pick<Partial<HackSignal>, 'triage_status' | 'operator_note'>) => {
      updateSignal(id, patch);
      if (!supabase) return;
      const { error } = await supabase.from('lumos_hack_signals').update(patch).eq('id', id);
      if (error) console.error('Triage update error:', error);
      else await fetchExactCounts();
    },
    [fetchExactCounts, updateSignal],
  );

  const fetchSignalsPage = useCallback(async (page: number, append: boolean): Promise<void> => {
    if (!supabase) return;
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('lumos_hack_signals')
      .select('*')
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, end);
    if (error) {
      console.error('Fetch signals error:', error);
      return;
    }
    const rows = (data ?? []) as HackSignal[];
    setSignals((prev) => (append ? [...prev, ...rows] : rows));
    setSignalsHasMore(rows.length === PAGE_SIZE);
    setSignalsPage(page);
  }, []);

  const fetchSkippedPage = useCallback(async (page: number, append: boolean): Promise<void> => {
    if (!supabase) return;
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('lumos_skipped_messages')
      .select('*')
      .order('skipped_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, end);
    if (error) {
      console.error('Fetch skipped error:', error);
      return;
    }
    const rows = (data ?? []) as SkippedMessage[];
    setSkipped((prev) => (append ? [...prev, ...rows] : rows));
    setSkippedHasMore(rows.length === PAGE_SIZE);
    setSkippedPage(page);
  }, []);

  useEffect(() => {
    void Promise.all([fetchSignalsPage(0, false), fetchSkippedPage(0, false), fetchExactCounts()]).finally(() => {
      setLoading(false);
    });
  }, [fetchExactCounts, fetchSignalsPage, fetchSkippedPage]);

  const loadMoreSignals = useCallback(async () => {
    if (loadingMoreSignals || !signalsHasMore) return;
    setLoadingMoreSignals(true);
    await fetchSignalsPage(signalsPage + 1, true);
    setLoadingMoreSignals(false);
  }, [fetchSignalsPage, signalsPage, signalsHasMore, loadingMoreSignals]);

  const loadMoreSkipped = useCallback(async () => {
    if (loadingMoreSkipped || !skippedHasMore) return;
    setLoadingMoreSkipped(true);
    await fetchSkippedPage(skippedPage + 1, true);
    setLoadingMoreSkipped(false);
  }, [fetchSkippedPage, skippedPage, skippedHasMore, loadingMoreSkipped]);

  const sourceFiltered = useMemo(() => {
    if (sourceFilter === 'all') return signals;
    return signals.filter((s) => s.source === sourceFilter);
  }, [signals, sourceFilter]);

  const sectionBuckets = useMemo(() => {
    const incident: HackSignal[] = [];
    const review: HackSignal[] = [];
    const normal: HackSignal[] = [];
    for (const s of sourceFiltered) {
      const k = classifySection(s);
      if (k === 'incident') incident.push(s);
      else if (k === 'review') review.push(s);
      else normal.push(s);
    }
    return { incident, review, normal };
  }, [sourceFiltered]);

  const incidentGroups = useMemo(
    () => sortIncidents(buildIncidentGroups(sectionBuckets.incident), sortBy),
    [sectionBuckets.incident, sortBy],
  );

  const reviewSignals = useMemo(
    () => sortSignals(sectionBuckets.review, sortBy),
    [sectionBuckets.review, sortBy],
  );

  const normalSignals = useMemo(
    () => sortSignals(sectionBuckets.normal, sortBy),
    [sectionBuckets.normal, sortBy],
  );

  const showIncident = filter === 'all' || filter === 'hack';
  const showReview = filter === 'all' || filter === 'hack';
  const showNormal = filter === 'all' || filter === 'normal';

  const stats = useMemo(
    () => ({
      total: exactCounts.total ?? signals.length,
      hack: exactCounts.hack ?? signals.filter(isHackSignal).length,
      skippedCount: exactCounts.skipped ?? skipped.length,
      escalated: exactCounts.escalated ?? signals.filter((s) => s.triage_status === 'escalated').length,
    }),
    [exactCounts, signals, skipped],
  );

  const visibleCount =
    (showIncident ? incidentGroups.length : 0) +
    (showReview ? reviewSignals.length : 0) +
    (showNormal ? normalSignals.length : 0);

  const toggleIncident = useCallback((key: string) => {
    setExpandedIncidents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hack Signals</h1>
          <p className="page-subtitle">실시간 DeFi 해킹 감지 신호</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 24,
      }}>
        <StatCard label="총 신호" value={stats.total} />
        <StatCard label="HACK 감지" value={stats.hack} accent="red" />
        <StatCard label="스킵됨" value={stats.skippedCount} muted />
        <StatCard label="Escalated" value={stats.escalated} accent="amber" />
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${tab === 'signals' ? 'active' : ''}`} onClick={() => setTab('signals')}>
          신호{' '}
          <span className="text-tertiary" style={{ marginLeft: 4 }}>
            {exactCounts.total ?? signals.length}
            {exactCounts.total == null && signalsHasMore ? '+' : ''}
          </span>
        </button>
        <button className={`tab ${tab === 'skipped' ? 'active' : ''}`} onClick={() => setTab('skipped')}>
          스킵됨{' '}
          <span className="text-tertiary" style={{ marginLeft: 4 }}>
            {exactCounts.skipped ?? skipped.length}
            {exactCounts.skipped == null && skippedHasMore ? '+' : ''}
          </span>
        </button>
      </div>

      {tab === 'signals' && (
        <>
          {/* Filters */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 24,
            alignItems: 'center', flexWrap: 'wrap',
          }}>
            {(['all', 'hack', 'normal'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: filter === f ? 700 : 500,
                  background:
                    filter === f
                      ? f === 'hack'
                        ? RED
                        : 'var(--color-accent)'
                      : 'var(--color-bg-secondary)',
                  color: filter === f ? '#fff' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {f === 'all' ? '전체' : f === 'hack' ? 'HACK' : '일반'}
              </button>
            ))}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilterType)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                fontSize: 13,
              }}
            >
              <option value="all">모든 소스</option>
              <option value="twitter">Twitter</option>
              <option value="telegram">Telegram</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                fontSize: 13,
              }}
            >
              <option value="newest">최신순</option>
              <option value="confidence">Confidence순</option>
              <option value="loss">피해액순</option>
            </select>
            <span className="text-tertiary" style={{ fontSize: 12, marginLeft: 'auto' }}>
              {visibleCount}건 표시
            </span>
          </div>

          {/* Section: 활성 인시던트 */}
          {showIncident && (
            <section style={{ marginBottom: 32 }}>
              <SectionHeader
                title="활성 인시던트"
                count={incidentGroups.length}
                accent="red"
                hint={incidentGroups.length > 0 ? '카드 클릭 시 멤버 신호 펼치기' : undefined}
              />
              {incidentGroups.length === 0 ? (
                <EmptySection message="아직 활성 인시던트가 없습니다" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {incidentGroups.map((g) => (
                    <IncidentCard
                      key={g.key}
                      group={g}
                      expanded={expandedIncidents.has(g.key)}
                      onToggle={() => toggleIncident(g.key)}
                      onSignalClick={setSelectedSignal}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section: 검토 필요 */}
          {showReview && (
            <section style={{ marginBottom: 32 }}>
              <SectionHeader title="검토 필요" count={reviewSignals.length} accent="amber" />
              {reviewSignals.length === 0 ? (
                <EmptySection message="검토할 신호가 없습니다" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviewSignals.map((s) => (
                    <ReviewCard key={s.id} signal={s} onClick={() => setSelectedSignal(s)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section: 일반 신호 */}
          {showNormal && (
            <section style={{ marginBottom: 28 }}>
              <SectionHeader title="일반 신호" count={normalSignals.length} accent="gray" />
              {normalSignals.length === 0 ? (
                <EmptySection message="일반 신호가 없습니다" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {normalSignals.map((s) => (
                    <NormalRow key={s.id} signal={s} onClick={() => setSelectedSignal(s)} />
                  ))}
                </div>
              )}
            </section>
          )}

          <LoadMoreButton
            onClick={loadMoreSignals}
            loading={loadingMoreSignals}
            hasMore={signalsHasMore}
          />
        </>
      )}

      {tab === 'skipped' && (
        <>
          {skipped.length === 0 ? (
            <div className="empty-state">
              <p className="text-secondary">스킵된 메시지가 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skipped.map((s) => (
                <div key={s.id} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      display: 'flex', gap: 8, alignItems: 'center',
                      minWidth: 0, flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 4,
                        background: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-tertiary)',
                      }}>
                        {s.skip_reason}
                      </span>
                      <span style={{ fontSize: 13 }}>{s.channel_name}</span>
                      {s.raw_text && (
                        <span className="text-tertiary" style={{ fontSize: 12 }}>
                          "{s.raw_text.slice(0, 80)}{s.raw_text.length > 80 ? '...' : ''}"
                        </span>
                      )}
                    </div>
                    <span className="text-tertiary" style={{ fontSize: 11, flexShrink: 0 }}>
                      {timeAgo(s.skipped_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <LoadMoreButton
            onClick={loadMoreSkipped}
            loading={loadingMoreSkipped}
            hasMore={skippedHasMore}
          />
        </>
      )}

      {selectedSignal && (
        <SignalDetail
          signal={selectedSignal}
          triageStatus={selectedSignal.triage_status ?? undefined}
          operatorNote={selectedSignal.operator_note ?? ''}
          onTriageChange={(status) => updateTriage(selectedSignal.id, { triage_status: status })}
          onNoteChange={(note) => updateTriage(selectedSignal.id, { operator_note: note })}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
}
