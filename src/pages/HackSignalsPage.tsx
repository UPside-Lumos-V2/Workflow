import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ──
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

function isHackSignal(s: HackSignal): boolean {
  return s.has_hack_keyword || s.alert_status === 'alerted' || s.alert_status === 'follow_up';
}

// ── Metadata chips: 감지된 것만 표시 ──
function MetadataChips({ signal }: { signal: HackSignal }) {
  const chips: ReactNode[] = [];

  if (signal.loss_usd != null) {
    chips.push(
      <span key="loss" style={{ fontWeight: 700, color: '#DC2626' }}>
        {formatUsd(signal.loss_usd)}
      </span>
    );
  }
  if (signal.protocol_name) {
    chips.push(
      <span key="protocol" style={{ fontWeight: 600 }}>
        {signal.protocol_name}
      </span>
    );
  }
  if (signal.chain) {
    chips.push(
      <span key="chain" style={{ textTransform: 'capitalize' as const }}>
        {signal.chain}
      </span>
    );
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
      fontSize: 12,
      color: 'var(--color-text-secondary)',
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      flexWrap: 'wrap',
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

// ── Detail Modal ──
function MetadataCell({
  label,
  value,
  missing,
  wide = false,
  monospace = false,
}: {
  label: string;
  value: ReactNode;
  missing: boolean;
  wide?: boolean;
  monospace?: boolean;
}) {
  return (
    <div style={{
      gridColumn: wide ? 'span 2' : undefined,
      minWidth: 0,
    }}>
      <span className="text-tertiary" style={{ fontSize: 11 }}>{label}</span>
      <div style={{
        marginTop: 3,
        minHeight: 20,
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

function SignalDetail({ signal, onClose }: { signal: HackSignal; onClose: () => void }) {
  const hack = isHackSignal(signal);
  const rawJson = JSON.stringify(signal, null, 2);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{
        maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto',
        padding: 24,
        borderLeft: hack ? '4px solid #DC2626' : undefined,
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {hack && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px',
                  borderRadius: 4, background: '#DC2626', color: '#fff',
                  letterSpacing: '0.05em',
                }}>
                  HACK
                </span>
              )}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {signal.source_author}
              </h3>
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
                style={{ fontSize: 12, textDecoration: 'none', color: '#3B82F6' }}
                onClick={(e) => e.stopPropagation()}
              >
                원본 보기 ↗
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 추출 필드 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
          marginBottom: 16, padding: 12, background: 'var(--color-bg-secondary)',
          borderRadius: 8,
        }}>
          <MetadataCell label="Protocol" value={signal.protocol_name} missing={!signal.protocol_name} />
          <MetadataCell label="Chain" value={signal.chain} missing={!signal.chain} />
          <MetadataCell label="Loss" value={signal.loss_usd != null ? formatUsd(signal.loss_usd) : null} missing={signal.loss_usd == null} />
          <MetadataCell label="Confidence" value={signal.confidence_score != null ? String(signal.confidence_score) : null} missing={signal.confidence_score == null} />
          <MetadataCell label="Tx Hash" value={signal.tx_hash ? truncateHash(signal.tx_hash, 16) : null} missing={!signal.tx_hash} wide monospace />
          <MetadataCell label="Attacker" value={signal.attacker_address} missing={!signal.attacker_address} wide monospace />
          <MetadataCell label="Incident Group" value={signal.incident_group_id} missing={!signal.incident_group_id} wide monospace />
        </div>

        {/* 원문 */}
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


// ── Main Page ──
export function HackSignalsPage() {
  const [tab, setTab] = useState<TabType>('signals');
  const [signals, setSignals] = useState<HackSignal[]>([]);
  const [skipped, setSkipped] = useState<SkippedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignal, setSelectedSignal] = useState<HackSignal | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  // Fetch signals
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const fetchData = async () => {
      const { data: sigs } = await client
        .from('lumos_hack_signals')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(100);

      const { data: skips } = await client
        .from('lumos_skipped_messages')
        .select('*')
        .order('skipped_at', { ascending: false })
        .limit(100);

      setSignals(sigs || []);
      setSkipped(skips || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Filtered signals
  const filtered = useMemo(() => {
    if (filter === 'hack') return signals.filter(isHackSignal);
    if (filter === 'normal') return signals.filter(s => !isHackSignal(s));
    return signals;
  }, [signals, filter]);

  // Stats (3개만)
  const stats = useMemo(() => ({
    total: signals.length,
    hack: signals.filter(isHackSignal).length,
    skippedCount: skipped.length,
  }), [signals, skipped]);

  if (loading) {
    return <div className="empty-state"><p className="text-secondary">Loading...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hack Signals</h1>
          <p className="page-subtitle">실시간 DeFi 해킹 감지 신호</p>
        </div>
      </div>

      {/* Stats — 3개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>총 신호</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.total}</div>
        </div>
        <div className="card" style={{
          padding: '14px 16px', textAlign: 'center',
          borderLeft: '3px solid #DC2626',
        }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>HACK 감지</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{stats.hack}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>스킵됨</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-tertiary)' }}>{stats.skippedCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${tab === 'signals' ? 'active' : ''}`} onClick={() => setTab('signals')}>
          신호 <span className="text-tertiary" style={{ marginLeft: 4 }}>{signals.length}</span>
        </button>
        <button className={`tab ${tab === 'skipped' ? 'active' : ''}`} onClick={() => setTab('skipped')}>
          스킵됨 <span className="text-tertiary" style={{ marginLeft: 4 }}>{skipped.length}</span>
        </button>
      </div>

      {tab === 'signals' && (
        <>
          {/* Filter: All / HACK / Normal */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
            {(['all', 'hack', 'normal'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: filter === f ? 700 : 500,
                  background: filter === f
                    ? (f === 'hack' ? '#DC2626' : 'var(--color-accent)')
                    : 'var(--color-bg-secondary)',
                  color: filter === f
                    ? '#fff'
                    : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {f === 'all' ? '전체' : f === 'hack' ? 'HACK' : '일반'}
              </button>
            ))}
            <span className="text-tertiary" style={{ fontSize: 12, marginLeft: 'auto' }}>
              {filtered.length}건
            </span>
          </div>

          {/* Signal List */}
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="text-secondary">아직 감지된 신호가 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((s) => {
                const hack = isHackSignal(s);
                return (
                  <div
                    key={s.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      borderLeft: hack ? '3px solid #DC2626' : undefined,
                      background: hack ? '#FEF2F2' : undefined,
                      transition: 'box-shadow 150ms ease',
                    }}
                    onClick={() => setSelectedSignal(s)}
                  >
                    {/* Row 1: header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hack && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#DC2626',
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: '#DC2626', display: 'inline-block',
                            }} />
                            HACK
                          </span>
                        )}
                        {s.source_url ? (
                          <a
                            href={s.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 13, fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              textDecoration: 'none',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.source_author} <span style={{ fontSize: 10, color: '#3B82F6' }}>↗</span>
                          </a>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{s.source_author}</span>
                        )}
                        <span className="text-tertiary" style={{ fontSize: 11 }}>
                          · Tier {s.source_author_tier} · {s.source === 'twitter' ? 'Twitter' : 'Telegram'}
                        </span>
                      </div>
                      <span className="text-tertiary" style={{ fontSize: 11, flexShrink: 0 }}>
                        {timeAgo(s.published_at)}
                      </span>
                    </div>

                    {/* Row 2: raw text */}
                    <p style={{
                      fontSize: 13,
                      color: 'var(--color-text-secondary)',
                      marginBottom: 6,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}>
                      {s.raw_text.slice(0, 200)}
                    </p>

                    {/* Row 3: metadata chips */}
                    <MetadataChips signal={s} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'skipped' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {skipped.length === 0 ? (
            <div className="empty-state">
              <p className="text-secondary">스킵된 메시지가 없습니다</p>
            </div>
          ) : (
            skipped.map((s) => (
              <div key={s.id} className="card" style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px',
                      borderRadius: 4, background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-tertiary)',
                    }}>
                      {s.skip_reason}
                    </span>
                    <span style={{ fontSize: 13 }}>{s.channel_name}</span>
                    {s.raw_text && (
                      <span className="text-tertiary" style={{ fontSize: 12 }}>
                        "{s.raw_text.slice(0, 40)}{(s.raw_text?.length || 0) > 40 ? '...' : ''}"
                      </span>
                    )}
                  </div>
                  <span className="text-tertiary" style={{ fontSize: 11 }}>
                    {timeAgo(s.skipped_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSignal && (
        <SignalDetail signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
      )}
    </div>
  );
}
