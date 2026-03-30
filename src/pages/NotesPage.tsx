import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes, useMembers, useWeekly } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { EmptyState } from '../components/shared';

type NoteTab = '전체' | '노트' | '회의록' | '할 일';
const TABS: NoteTab[] = ['전체', '노트', '회의록', '할 일'];

export function NotesPage() {
  const { items: notes, add } = useNotes();
  const { items: members } = useMembers();
  const { items: weeklies } = useWeekly();
  const { currentMember } = useCurrentMember();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<NoteTab>('전체');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? '';

  const sorted = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // 탭 필터
  const tabFiltered = sorted.filter((n) => {
    if (activeTab === '전체') return true;
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

  /** 이전 주차 데이터를 기반으로 회의록 초안 생성 */
  const buildMeetingDraft = (): string => {
    // 이전 주 시작일 계산 (현재 주 월요일 - 7일)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const currentStart = new Date(now);
    currentStart.setDate(diff);
    currentStart.setHours(0, 0, 0, 0);
    const prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevWeekStart = prevStart.toISOString().slice(0, 10);

    // 이전 주차 weekly 찾기
    const prevWeekly = weeklies.find((w) => w.weekStart === prevWeekStart);

    const sections: string[] = [];

    // 이전 주차 팀원별 할 일 요약
    if (prevWeekly?.memberTasks) {
      sections.push('## 📋 전 주차 팀원별 할 일 현황\n');
      for (const member of members) {
        const tasks = prevWeekly.memberTasks[member.id] ?? [];
        if (tasks.length === 0) continue;
        const taskLines = tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n');
        sections.push(`### ${member.name}\n${taskLines}\n`);
      }
    }

    // 이전 주차 피드백
    if (prevWeekly?.mentoringFeedback) {
      sections.push(`## 💬 전 주차 멘토링 피드백\n${prevWeekly.mentoringFeedback}\n`);
    }

    // 이전 주차 이월 항목
    if (prevWeekly?.carryOver && prevWeekly.carryOver.length > 0) {
      sections.push(`## 📦 이월 항목\n${prevWeekly.carryOver.map((c) => `- ${c}`).join('\n')}\n`);
    }

    // 이번 주 피드백/할 일 작성 영역
    sections.push('## 🎯 이번 주 목표\n-\n');
    sections.push('## ✅ 이번 주 할 일\n-\n');
    sections.push('## 💬 멘토링 피드백\n\n');
    sections.push('## 🚀 액션 아이템\n-\n');

    return sections.join('\n');
  };

  const handleCreateMeeting = async () => {
    if (!currentMember) return;
    const now = new Date();
    const title = `${now.getMonth() + 1}월 ${now.getDate()}일 멘토링`;
    const content = buildMeetingDraft();

    // 현재 주차 weekly 찾기/연결
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(now);
    weekStartDate.setDate(diff);
    weekStartDate.setHours(0, 0, 0, 0);
    const weekStart = weekStartDate.toISOString().slice(0, 10);
    const currentWeekly = weeklies.find((w) => w.weekStart === weekStart);

    const newNote = await add({
      title,
      content,
      status: 'draft',
      authorId: currentMember.id,
      linkedCaseId: null,
      linkedWeeklyId: currentWeekly?.id ?? null,
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
            📋 회의록 작성
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
                    <span style={{ fontWeight: 600, flex: 1 }}>{note.title || '제목 없음'}</span>
                    <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {getMemberName(note.authorId)}
                    </span>
                    <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {formatDate(note.updatedAt)}
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
