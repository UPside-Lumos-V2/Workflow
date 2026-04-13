import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes, useMembers, useWeekly, useCases } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { EmptyState } from '../components/shared';
import { getWeekStartDate, toLocalDateString } from '../lib/date';

type NoteTab = '이번주' | '전체' | '내 노트' | '노트' | '회의록' | '할 일';
const TABS: NoteTab[] = ['이번주', '전체', '내 노트', '노트', '회의록', '할 일'];

function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const weekNum = Math.ceil(((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  return `Week ${weekNum} (${fmt(start)} ~ ${fmt(end)})`;
}

export function NotesPage() {
  const { items: notes, add } = useNotes();
  const { items: members } = useMembers();
  const { items: weeklies, add: addWeekly } = useWeekly();
  const { items: cases } = useCases();
  const { currentMember } = useCurrentMember();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<NoteTab>('이번주');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? '';

  // 생성 날짜 기준 정렬 (최신순)
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 이번 주 범위 계산 (화~월)
  const currentWeekStart = getWeekStartDate();
  const weekStartDate = new Date(currentWeekStart + 'T00:00:00');
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7); // 다음 화요일 00:00 (exclusive)

  // 이번 주 weekly ID 목록
  const currentWeeklyIds = new Set(
    weeklies
      .filter((w) => w.weekStart === currentWeekStart)
      .map((w) => w.id)
  );

  /** 노트가 "이번주"에 해당하는지 판정 (linkedWeeklyId 우선) */
  const isThisWeekNote = (note: typeof notes[0]): boolean => {
    // 1순위: linkedWeeklyId가 이번 주 weekly에 해당하면 이번 주
    if (note.linkedWeeklyId) {
      return currentWeeklyIds.has(note.linkedWeeklyId);
    }
    // 2순위: linkedWeeklyId가 없으면 createdAt이 이번 주 범위인지 확인
    const created = new Date(note.createdAt);
    return created >= weekStartDate && created < weekEndDate;
  };

  // 탭 필터
  const tabFiltered = sorted.filter((n) => {
    if (activeTab === '이번주') return isThisWeekNote(n);
    if (activeTab === '전체') return true;
    if (activeTab === '내 노트') return n.authorId === currentMember?.id;
    if (activeTab === '회의록') return n.tags.includes('회의록');
    if (activeTab === '할 일') return n.tags.includes('할 일');
    // '노트' = 회의록도 할 일도 아닌 것
    return !n.tags.includes('회의록') && !n.tags.includes('할 일');
  });

  // 검색 필터
  const filtered = search.trim()
    ? tabFiltered.filter((n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
    )
    : tabFiltered;

  const handleCreateNote = async () => {
    if (!currentMember) return;
    const newNote = await add({
      title: '새 노트',
      content: '',
      status: 'draft',
      authorId: currentMember.id,
      linkedCaseId: null,
      linkedWeeklyId: null,
      tags: [],
    });
    if (newNote) navigate(`/app/notes/${newNote.id}`);
  };

  /** 현재 주차 데이터를 기반으로 회의록 초안 생성 */
  const buildMeetingDraft = (): string => {
    // 현재 주 시작일 계산
    const currentWeekStart = getWeekStartDate();

    // 현재 주차 weekly 찾기 (±6일 fallback)
    let currentWeekly = weeklies.find((w) => w.weekStart === currentWeekStart);
    if (!currentWeekly) {
      const base = new Date(currentWeekStart + 'T00:00:00');
      for (const offset of [-1, 1, -6, 6, -2, 2, -5, 5]) {
        const probe = new Date(base);
        probe.setDate(probe.getDate() + offset);
        const probeStr = toLocalDateString(probe);
        currentWeekly = weeklies.find((w) => w.weekStart === probeStr);
        if (currentWeekly) break;
      }
    }

    // 멘토(Zeroluck) 제외한 팀원만
    const draftMembers = members.filter((m) => m.name.toLowerCase() !== 'zeroluck');

    const sections: string[] = [];

    // 1. 멤버별 현재 주차 한 일 정리
    sections.push('## 📋 멤버별 이번 주 한 일 정리\n');
    for (const member of draftMembers) {
      const tasks = currentWeekly?.memberTasks?.[member.id] ?? [];
      const taskLines = tasks.length > 0
        ? tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n')
        : '- ';
      sections.push(`### ${member.name}\n${taskLines}\n`);
    }

    // 2. 이번 주 회의 내용
    sections.push('## 📝 회의 내용\n\n');

    return sections.join('\n');
  };

  const handleCreateMeeting = async () => {
    if (!currentMember) return;
    const now = new Date();
    const title = `${now.getMonth() + 1}월 ${now.getDate()}일 멘토링`;
    const content = buildMeetingDraft();

    // 다음 주차 weekly 찾기/연결
    // 주간 사이클: 화~월. 월요일 회의 요약은 다음 날(화요일) 시작 주차에 반영되어야 함.
    const currentWeekStart = getWeekStartDate();
    const nextWeekStartDate = new Date(currentWeekStart + 'T00:00:00');
    nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 7);
    const nextWeekStart = toLocalDateString(nextWeekStartDate);

    let targetWeekly = weeklies.find((w) => w.weekStart === nextWeekStart);
    if (!targetWeekly) {
      // ±1일 fallback 탐색
      const base = new Date(nextWeekStart + 'T00:00:00');
      for (const offset of [-1, 1, -2, 2]) {
        const probe = new Date(base);
        probe.setDate(probe.getDate() + offset);
        const probeStr = toLocalDateString(probe);
        targetWeekly = weeklies.find((w) => w.weekStart === probeStr);
        if (targetWeekly) break;
      }
    }

    // 다음 주차가 없으면 자동 생성 ('이번 주 시작하기'와 동일)
    if (!targetWeekly) {
      targetWeekly = await addWeekly({
        weekLabel: getWeekLabel(nextWeekStart),
        weekStart: nextWeekStart,
        goals: [],
        activeCaseIds: cases.filter((c) => c.status !== 'closed').map((c) => c.id),
        memberTasks: {},
        mentoringAgenda: '',
        mentoringFeedback: '',
        mentoringActionItems: [],
        carryOver: [],
      }) ?? undefined;
    }

    const newNote = await add({
      title,
      content,
      status: 'draft',
      authorId: currentMember.id,
      linkedCaseId: null,
      linkedWeeklyId: targetWeekly?.id ?? null,
      tags: ['회의록'],
    });
    if (newNote) navigate(`/app/notes/${newNote.id}`);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const preview = (content: string) => {
    if (!content) return '내용 없음';
    // Block JSON인 경우 텍스트만 추출
    try {
      const blocks = JSON.parse(content);
      if (Array.isArray(blocks)) {
        const extractText = (items: unknown[]): string => {
          return items
            .map((block: any) => {
              const inline = block?.content;
              if (Array.isArray(inline)) {
                return inline
                  .map((c: any) => (typeof c === 'string' ? c : c?.text ?? ''))
                  .join('');
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');
        };
        const text = extractText(blocks).trim();
        if (text) return text.slice(0, 80) + (text.length > 80 ? '...' : '');
        return '내용 없음';
      }
    } catch {
      // plain text fallback
    }
    return content.slice(0, 80) + (content.length > 80 ? '...' : '');
  };

  const getTagBadge = (tags: string[]) => {
    if (tags.includes('회의록')) return { label: '회의록', color: '#1E3A65' };
    if (tags.includes('할 일')) return { label: '할 일', color: '#9F34B4' };
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">노트</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleCreateMeeting}>
            회의록 작성
          </button>
          <button className="btn btn-primary" onClick={handleCreateNote}>
            + 새 노트
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveTab(tab); setPage(1); }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="노트 검색"
        style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          message={search ? '검색 결과가 없습니다' : '아직 노트가 없습니다'}
          actionLabel={search ? undefined : '새 노트 만들기'}
          onAction={search ? undefined : handleCreateNote}
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((note) => {
              const badge = getTagBadge(note.tags);
              return (
                <div
                  key={note.id}
                  className="card"
                  style={{ padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => navigate(`/app/notes/${note.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    {badge && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 10,
                        background: badge.color, color: '#fff',
                      }}>
                        {badge.label}
                      </span>
                    )}
                    {note.authorId === currentMember?.id && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 10,
                        background: '#9F34B4', color: '#fff',
                      }}>
                        나
                      </span>
                    )}
                    <span style={{ fontWeight: 600, flex: 1 }}>{note.title || '제목 없음'}</span>
                    <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {getMemberName(note.authorId)}
                    </span>
                    <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  <div className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {preview(note.content)}
                  </div>
                </div>
              );
            })}
          </div>
          {/* 페이지네이션 */}
          {filtered.length > PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ←
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>
                {page} / {Math.ceil(filtered.length / PER_PAGE)}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= Math.ceil(filtered.length / PER_PAGE)}
                onClick={() => setPage(page + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
