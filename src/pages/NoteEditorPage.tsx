import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotes, useCases, useWeekly, useMembers } from '../hooks/useStore';

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, edit, remove } = useNotes();
  const { items: cases } = useCases();
  const { items: weeklies } = useWeekly();
  const { items: members } = useMembers();

  const note = getById(id ?? '');

  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // note 로딩 후 로컬 state 동기화 (외부 데이터 → 로컬 state)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const sortedWeeklies = useMemo(
    () => [...weeklies].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [weeklies],
  );

  const save = (patch: Record<string, unknown>) => {
    if (note) edit(note.id, patch);
  };

  const handleDelete = async () => {
    if (note) {
      await remove(note.id);
      navigate('/app/notes');
    }
  };

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? '';

  if (!note) {
    return (
      <div className="empty-state">
        <p>노트를 찾을 수 없습니다</p>
        <button className="btn btn-secondary" onClick={() => navigate('/app/notes')}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const tagBadge = note.tags.includes('회의록')
    ? { label: '회의록', color: '#1E3A65' }
    : note.tags.includes('할 일')
    ? { label: '할 일', color: '#9F34B4' }
    : null;

  return (
    <div>
      <button className="btn btn-ghost" onClick={() => navigate('/app/notes')} style={{ marginBottom: 16 }}>
        ← 노트 목록
      </button>

      {/* 태그 + 작성자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {tagBadge && (
          <span style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 600,
            padding: '3px 10px', borderRadius: 10,
            background: tagBadge.color, color: '#fff',
          }}>
            {tagBadge.label}
          </span>
        )}
        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
          {getMemberName(note.authorId)}
        </span>
      </div>

      {/* 제목 */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== note.title) save({ title }); }}
        placeholder="제목 입력"
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 700,
          border: 'none',
          borderBottom: '1px solid var(--color-border-light)',
          width: '100%',
          paddingBottom: 8,
          marginBottom: 20,
          background: 'transparent',
          letterSpacing: '-0.02em',
        }}
      />

      {/* 본문 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => { if (content !== note.content) save({ content }); }}
        placeholder="내용을 작성하세요"
        style={{
          width: '100%',
          minHeight: 400,
          resize: 'vertical',
          fontSize: 'var(--font-size-base)',
          lineHeight: 1.7,
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
        }}
      />

      {/* 연결 */}
      <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">연결 케이스</label>
          <select
            value={note.linkedCaseId ?? ''}
            onChange={(e) => save({ linkedCaseId: e.target.value || null })}
          >
            <option value="">없음</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">연결 주간</label>
          <select
            value={note.linkedWeeklyId ?? ''}
            onChange={(e) => save({ linkedWeeklyId: e.target.value || null })}
          >
            <option value="">없음</option>
            {sortedWeeklies.map((w) => (
              <option key={w.id} value={w.id}>{w.weekLabel}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 삭제 */}
      <div style={{ marginTop: 24, borderTop: '1px solid var(--color-border-light)', paddingTop: 16 }}>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-priority-high)' }}>
              정말 삭제하시겠습니까?
            </span>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--color-priority-high)', color: '#fff' }}
              onClick={handleDelete}
            >
              삭제
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-priority-high)' }}
            onClick={() => setConfirmDelete(true)}
          >
            노트 삭제
          </button>
        )}
      </div>
    </div>
  );
}
