import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes, useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { EmptyState } from '../components/shared';

type NoteTab = '전체' | '노트' | '회의록' | '할 일';
const TABS: NoteTab[] = ['전체', '노트', '회의록', '할 일'];

export function NotesPage() {
  const { items: notes, add } = useNotes();
  const { items: members } = useMembers();
  const { currentMember } = useCurrentMember();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<NoteTab>('전체');

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

  const handleCreateMeeting = async () => {
    if (!currentMember) return;
    const now = new Date();
    const title = `${now.getMonth() + 1}월 ${now.getDate()}일 멘토링`;
    const newNote = await add({
      title,
      content: '',
      status: 'draft',
      authorId: currentMember.id,
      linkedCaseId: null,
      linkedWeeklyId: null,
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
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((note) => {
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
      )}
    </div>
  );
}
