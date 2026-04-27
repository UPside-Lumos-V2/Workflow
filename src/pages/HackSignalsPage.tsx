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
        fontFamily: monospace ? 'monospace' : undefined,
        fontWeight: missing ? 500 : 600,
        color: missing ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        wordBreak: 'break-all',
      }}>
        {missing ? 'Not detected' : value}
      </div>
    </div>
  );
}

function SourceBadge({ source, url }: { source: string; url?: string }) {
  const isTwitter = source === 'twitter';
  const label = isTwitter ? 'Twitter' : 'Telegram';
  const bg = isTwitter ? '#0d1216ff' : '#0088CC';
  const badge = (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 10, background: `${bg}18`, color: bg,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {label}
    </span>
  );
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {badge}<span style={{ fontSize: 10, color: bg, marginLeft: 2 }}>↗</span>
      </a>
    );
  }
  return badge;
}

function AlertStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === 'pending') return null;
  const map: Record<string, { label: string; bg: string; color: string }> = {
    alerted: { label: 'Alerted', bg: '#FFEBEE', color: '#C62828' },
    follow_up: { label: 'Follow-up', bg: '#FFF8E1', color: '#F57F17' },
    silent: { label: 'Silent', bg: '#F5F5F5', color: '#888' },
  };
  const t = map[status] || map.silent;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px',
      borderRadius: 10, background: t.bg, color: t.color,
    }}>
      {t.label}
    </span>
  );
}

// ── Components ──
function ChainBadge({ chain }: { chain: string }) {
  const colors: Record<string, string> = {
    ethereum: '#627EEA',
    bsc: '#F3BA2F',
    arbitrum: '#28A0F0',
    polygon: '#8247E5',
    optimism: '#FF0420',
    avalanche: '#E84142',
    base: '#0052FF',
    solana: '#9945FF',
    fantom: '#1969FF',
  };
  const bg = colors[chain] || '#888';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 12, background: `${bg}18`, color: bg,
      textTransform: 'capitalize',
    }}>
      {chain}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const map: Record<number, { label: string; bg: string; color: string }> = {
    1: { label: 'Tier 1', bg: '#E8F5E9', color: '#2E7D32' },
    2: { label: 'Tier 2', bg: '#FFF8E1', color: '#F57F17' },
    3: { label: 'Tier 3', bg: '#FFEBEE', color: '#C62828' },
  };
  const t = map[tier] || map[3];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px',
      borderRadius: 10, background: t.bg, color: t.color,
    }}>
      {t.label}
    </span>
  );
}

function SignalDetail({ signal, onClose }: { signal: HackSignal; onClose: () => void }) {
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
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {signal.source === 'twitter' ? '🐦' : '💬'} {signal.source_author}
            </h3>
            <span className="text-tertiary" style={{ fontSize: 12 }}>
              {new Date(signal.published_at).toLocaleString('ko-KR')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {signal.source_url && (
              <a
                href={signal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, textDecoration: 'none', color: 'var(--color-text-secondary)' }}
                onClick={(e) => e.stopPropagation()}
              >
                🔗 원본 보기
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
          <MetadataCell
            label="Protocol"
            value={signal.protocol_name}
            missing={!signal.protocol_name}
          />
          <MetadataCell
            label="Chain"
            value={signal.chain ? <ChainBadge chain={signal.chain} /> : null}
            missing={!signal.chain}
          />
          <MetadataCell
            label="Loss"
            value={signal.loss_usd != null ? formatUsd(signal.loss_usd) : null}
            missing={signal.loss_usd == null}
          />
          <MetadataCell
            label="Tx Hash"
            value={signal.tx_hash ? truncateHash(signal.tx_hash, 16) : null}
            missing={!signal.tx_hash}
            monospace
          />
          <MetadataCell
            label="Attacker"
            value={signal.attacker_address}
            missing={!signal.attacker_address}
            wide
            monospace
          />
          <MetadataCell
            label="Hack Keyword"
            value={signal.has_hack_keyword ? 'Detected' : 'Not detected'}
            missing={!signal.has_hack_keyword}
          />
          <MetadataCell
            label="Confidence"
            value={signal.confidence_score != null ? String(signal.confidence_score) : null}
            missing={signal.confidence_score == null}
          />
          <MetadataCell
            label="Incident Group"
            value={signal.incident_group_id}
            missing={!signal.incident_group_id}
            wide
            monospace
          />
          <MetadataCell
            label="Source ID"
            value={signal.source_id}
            missing={!signal.source_id}
            wide
            monospace
          />
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

  // Filters
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [keywordOnly, setKeywordOnly] = useState(false);
  const [alertedOnly, setAlertedOnly] = useState(false);

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

  // Unique chains for filter
  const chains = useMemo(() => {
    const set = new Set(signals.map(s => s.chain).filter(Boolean) as string[]);
    return ['all', ...Array.from(set).sort()];
  }, [signals]);

  // Filtered signals
  const filtered = useMemo(() => {
    let result = signals;
    if (chainFilter !== 'all') {
      result = result.filter(s => s.chain === chainFilter);
    }
    if (keywordOnly) {
      result = result.filter(s => s.has_hack_keyword);
    }
    if (alertedOnly) {
      result = result.filter(s => s.alert_status === 'alerted' || s.alert_status === 'follow_up');
    }
    return result;
  }, [signals, chainFilter, keywordOnly, alertedOnly]);

  // Stats
  const stats = useMemo(() => ({
    total: signals.length,
    withKeyword: signals.filter(s => s.has_hack_keyword).length,
    withProtocol: signals.filter(s => s.protocol_name).length,
    alertCount: signals.filter(s => s.alert_status === 'alerted' || s.alert_status === 'follow_up').length,
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>총 신호</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.total}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>해킹 키워드</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#C62828' }}>{stats.withKeyword}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>프로토콜 감지</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#9F34B4' }}>{stats.withProtocol}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>알림 발생</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#E65100' }}>{stats.alertCount}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>스킵됨</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#888' }}>{stats.skippedCount}</div>
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
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
                fontSize: 13, background: 'var(--color-bg-primary)',
              }}
            >
              {chains.map(c => (
                <option key={c} value={c}>{c === 'all' ? '전체 체인' : c}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={keywordOnly}
                onChange={(e) => setKeywordOnly(e.target.checked)}
              />
              해킹 키워드만
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={alertedOnly}
                onChange={(e) => setAlertedOnly(e.target.checked)}
              />
              알림 발생만
            </label>
            <span className="text-tertiary" style={{ fontSize: 12, marginLeft: 'auto' }}>
              {filtered.length}건 표시
            </span>
          </div>

          {/* Signal List */}
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="text-secondary">아직 감지된 신호가 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSignal(s)}
                >
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SourceBadge source={s.source} url={s.source_url} />
                      <span className="card-title" style={{ fontSize: 14 }}>{s.source_author}</span>
                      <TierBadge tier={s.source_author_tier} />
                      {s.has_hack_keyword && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px',
                          borderRadius: 10, background: '#FFEBEE', color: '#C62828',
                        }}>
                          HACK
                        </span>
                      )}
                      <AlertStatusBadge status={s.alert_status} />
                    </div>
                    <span className="text-tertiary" style={{ fontSize: 11 }}>
                      {timeAgo(s.published_at)}
                    </span>
                  </div>

                  <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 8 }}>
                    {s.raw_text.slice(0, 150)}{s.raw_text.length > 150 ? '...' : ''}
                  </p>

                  <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>Protocol: {s.protocol_name || 'Not detected'}</span>
                    <span>Chain: {s.chain ? <ChainBadge chain={s.chain} /> : 'Not detected'}</span>
                    <span>Loss: {s.loss_usd != null ? formatUsd(s.loss_usd) : 'Not detected'}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      Tx: {s.tx_hash ? truncateHash(s.tx_hash) : 'Not detected'}
                    </span>
                  </div>
                </div>
              ))}
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
                      fontSize: 10, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 10, background: '#F5F5F5', color: '#888',
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
