import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useNotes, useDiscussions } from '../hooks/useStore';

interface SearchResult {
  type: 'case' | 'note' | 'discussion';
  id: string;
  title: string;
  subtitle: string;
  path: string;
  icon: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { items: cases } = useCases();
  const { items: notes } = useNotes();
  const { items: discussions } = useDiscussions();

  // 모달 열릴 때 포커스 + query 초기화
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // ESC → 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // 검색 결과
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const out: SearchResult[] = [];

    // 케이스
    cases.forEach((c) => {
      if (c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) {
        out.push({
          type: 'case',
          id: c.id,
          title: c.title,
          subtitle: c.description?.slice(0, 60) || `${c.status} · ${c.metadata?.protocol ?? ''}`,
          path: `/app/cases/${c.id}`,
          icon: '📁',
        });
      }
    });

    // 노트
    notes.forEach((n) => {
      if (n.title.toLowerCase().includes(q)) {
        out.push({
          type: 'note',
          id: n.id,
          title: n.title,
          subtitle: n.tags.includes('회의록') ? '회의록' : '노트',
          path: `/app/notes/${n.id}`,
          icon: '📝',
        });
      }
    });

    // Discussion
    discussions.forEach((d) => {
      if (d.content.toLowerCase().includes(q) || d.contextLabel?.toLowerCase().includes(q)) {
        out.push({
          type: 'discussion',
          id: d.id,
          title: d.contextLabel || d.content.slice(0, 40),
          subtitle: d.content.slice(0, 60),
          path: d.contextType === 'case' ? `/app/cases/${d.contextId}` : '/app/weekly',
          icon: '💬',
        });
      }
    });

    return out.slice(0, 12); // 최대 12개
  }, [query, cases, notes, discussions]);

  // 선택 인덱스 범위 제한
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const goToResult = useCallback((result: SearchResult) => {
    navigate(result.path);
    onClose();
  }, [navigate, onClose]);

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
      // 스크롤 동기화
      setTimeout(() => {
        listRef.current?.children[Math.min(selectedIdx + 1, results.length - 1)]?.scrollIntoView({ block: 'nearest' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      goToResult(results[selectedIdx]);
    }
  };

  if (!isOpen) return null;

  const groupedResults = {
    case: results.filter((r) => r.type === 'case'),
    note: results.filter((r) => r.type === 'note'),
    discussion: results.filter((r) => r.type === 'discussion'),
  };

  let globalIdx = -1;

  return (
    <>
      {/* 배경 오버레이 — 반투명 블러 */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'searchOverlayIn 0.2s ease-out',
        }}
        onClick={onClose}
      />

      {/* 모달 본체 — 상단 중앙 */}
      <div
        style={{
          position: 'fixed',
          top: '15vh',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '100%',
          maxWidth: 560,
          animation: 'searchModalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 16,
            border: '1px solid rgba(159, 52, 180, 0.15)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18), 0 8px 24px rgba(159, 52, 180, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* 검색 입력 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px',
            borderBottom: query ? '1px solid rgba(0, 0, 0, 0.06)' : 'none',
          }}>
            <span style={{ fontSize: 20, opacity: 0.5, flexShrink: 0 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="케이스, 노트, 토론 검색..."
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 17, fontWeight: 500, color: '#1a1a1a',
                letterSpacing: '-0.01em',
              }}
            />
            <kbd style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px',
              background: 'rgba(0, 0, 0, 0.06)', borderRadius: 6,
              color: '#888', fontFamily: 'system-ui', flexShrink: 0,
            }}>
              ESC
            </kbd>
          </div>

          {/* 결과 */}
          {query && (
            <div
              ref={listRef}
              style={{
                maxHeight: 380, overflowY: 'auto', padding: '8px',
                scrollbarWidth: 'thin',
              }}
            >
              {results.length === 0 ? (
                <div style={{
                  padding: '32px 20px', textAlign: 'center',
                  color: '#999', fontSize: 14,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>🔎</div>
                  <span style={{ fontWeight: 500 }}>"{query}"</span>에 대한 결과가 없습니다
                </div>
              ) : (
                <>
                  {(['case', 'note', 'discussion'] as const).map((type) => {
                    const group = groupedResults[type];
                    if (group.length === 0) return null;
                    const labels = { case: '케이스', note: '노트', discussion: '토론' };

                    return (
                      <div key={type}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, color: '#999',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          padding: '8px 12px 4px',
                        }}>
                          {labels[type]}
                        </div>
                        {group.map((r) => {
                          globalIdx++;
                          const isSelected = globalIdx === selectedIdx;
                          const idx = globalIdx; // 클로저 캡처

                          return (
                            <div
                              key={r.id}
                              onClick={() => goToResult(r)}
                              onMouseEnter={() => setSelectedIdx(idx)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 12px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                background: isSelected
                                  ? 'linear-gradient(135deg, rgba(159, 52, 180, 0.08), rgba(124, 58, 237, 0.06))'
                                  : 'transparent',
                                transition: 'background 0.1s',
                              }}
                            >
                              {/* 아이콘 */}
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: isSelected
                                  ? 'linear-gradient(135deg, #9F34B4, #7C3AED)'
                                  : 'rgba(0, 0, 0, 0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, flexShrink: 0,
                                transition: 'background 0.15s',
                                filter: isSelected ? '' : 'grayscale(0.3)',
                              }}>
                                {r.icon}
                              </div>

                              {/* 텍스트 */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontWeight: 600, fontSize: 14, color: '#1a1a1a',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                  {highlightMatch(r.title, query)}
                                </div>
                                <div style={{
                                  fontSize: 12, color: '#888', marginTop: 1,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                  {r.subtitle}
                                </div>
                              </div>

                              {/* 엔터 힌트 */}
                              {isSelected && (
                                <kbd style={{
                                  fontSize: 10, fontWeight: 600, padding: '2px 6px',
                                  background: 'rgba(159, 52, 180, 0.1)', borderRadius: 5,
                                  color: '#9F34B4', fontFamily: 'system-ui', flexShrink: 0,
                                }}>
                                  ↵
                                </kbd>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* 하단 힌트 바 */}
          {query && results.length > 0 && (
            <div style={{
              display: 'flex', gap: 16, justifyContent: 'center',
              padding: '10px 16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              fontSize: 11, color: '#999',
            }}>
              <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> 이동</span>
              <span><kbd style={kbdStyle}>↵</kbd> 열기</span>
              <span><kbd style={kbdStyle}>esc</kbd> 닫기</span>
            </div>
          )}
        </div>
      </div>

      {/* 애니메이션 keyframes */}
      <style>{`
        @keyframes searchOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes searchModalIn {
          from { opacity: 0; transform: translateX(-50%) scale(0.96) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── 유틸 ──

const kbdStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: '1px 5px',
  background: 'rgba(0,0,0,0.06)', borderRadius: 4,
  fontFamily: 'system-ui',
};

/** 검색어 하이라이트 */
function highlightMatch(text: string, query: string): React.ReactNode {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: '#9F34B4', fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
