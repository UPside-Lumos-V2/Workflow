import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes, useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { EmptyState } from '../components/shared';

export function NotesPage() {
  const { items: notes, add } = useNotes();
  const { items: members } = useMembers();
  const { currentMember } = useCurrentMember();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? '';

  const filtered = search.trim()
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const handleCreate = async () => {
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
    if (newNote) {
      navigate(`/app/notes/${newNote.id}`);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const preview = (content: string) => {
    if (!content) return '내용 없음';
    return content.slice(0, 80) + (content.length > 80 ? '...' : '');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">노트</h1>
        <button className="btn btn-primary" onClick={handleCreate}>
          + 새 노트
        </button>
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
          onAction={search ? undefined : handleCreate}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((note) => (
            <div
              key={note.id}
              className="card"
              style={{ padding: '14px 18px', cursor: 'pointer' }}
              onClick={() => navigate(`/app/notes/${note.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
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
          ))}
        </div>
      )}
    </div>
  );
}
