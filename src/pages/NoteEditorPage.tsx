import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotes, useCases, useWeekly, useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { useNotePresence, getMemberColor } from '../hooks/useNotePresence';
import { summarizeMeetingNote } from '../lib/gemini';
import { SummaryPreviewModal } from '../components/SummaryPreviewModal';
import { BlockEditor } from '../components/BlockEditor';
import type { MeetingSummary } from '../types';

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, edit, remove, add: addNote } = useNotes();
  const { items: cases } = useCases();
  const { items: weeklies, edit: editWeekly } = useWeekly();
  const { items: members } = useMembers();
  const { currentMember } = useCurrentMember();

  const note = getById(id ?? '');

  // 멤버 색상
  const memberIndex = currentMember ? members.findIndex(m => m.id === currentMember.id) : 0;
  const memberColor = getMemberColor(memberIndex);

  // 실시간 편집 참여자 표시
  const activeEditors = useNotePresence(note?.id, currentMember, memberColor);

  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editorRef = useRef<any>(null);

  // 요약 관련 state
  const [summarizing, setSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<MeetingSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [transcript, setTranscript] = useState('');  // 녹음본 텍스트
  const [showTranscript, setShowTranscript] = useState(false);
  const [confirmSummarize, setConfirmSummarize] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // note 로딩 후 로컬 state 동기화
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const getMemberName = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? '';

  // ── 요약하기 ──
  const isMeetingNote = note?.tags.includes('회의록') ?? false;
  const canSummarize = isMeetingNote && (content.length >= 50 || (editorRef.current?.document?.length ?? 0) > 1);

  const handleSummarize = async () => {
    if (!canSummarize) return;
    if (!note?.linkedWeeklyId) {
      setSummaryError('연결 주간을 먼저 선택해주세요. 요약 결과가 해당 주간보드에 반영됩니다.');
      setConfirmSummarize(false);
      return;
    }
    setConfirmSummarize(false);

    setSummarizing(true);
    setSummaryError('');
    try {
      const memberNames = members.map((m) => m.name);
      // BlockNote → markdown 변환하여 LLM에 전달
      let textContent = content;
      if (editorRef.current) {
        try {
          textContent = await editorRef.current.blocksToMarkdownLossy(editorRef.current.document);
        } catch {
          // fallback: raw content
        }
      }
      const result = await summarizeMeetingNote(textContent, transcript, memberNames);
      setSummaryResult(result);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : '요약 중 오류 발생');
    } finally {
      setSummarizing(false);
    }
  };

  // ── 요약 반영 ──
  const handleSummaryConfirm = async (edited: MeetingSummary) => {
    if (!note) return;

    // 1. 요약 노트 생성 (원본 유지)
    const summaryContent = [
      edited.goals.length > 0 ? `## 🎯 이번 주 목표\n${edited.goals.map((g) => `- ${g}`).join('\n')}` : '',
      edited.tasks.length > 0 ? `## ✅ 할 일 목록\n${edited.tasks.map((t) => `- ${t}`).join('\n')}` : '',
      edited.mentoringFeedback ? `## 💬 멘토링 피드백\n${edited.mentoringFeedback}` : '',
      edited.carryOver.length > 0 ? `## 📦 이월 항목\n${edited.carryOver.map((c) => `- ${c}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    await addNote({
      title: `${note.title} (요약)`,
      content: summaryContent,
      status: 'published',
      authorId: note.authorId,
      linkedCaseId: note.linkedCaseId,
      linkedWeeklyId: note.linkedWeeklyId,
      tags: ['회의록'],
    });

    // 2. 주간보드에 반영 (append 방식) — 연결된 주간에 직접 반영
    const currentWeekly = note.linkedWeeklyId
      ? weeklies.find((w) => w.id === note.linkedWeeklyId)
      : null;

    console.log('[요약반영] targetWeekly:', currentWeekly?.id, currentWeekly?.weekStart);
    console.log('[요약반영] note.linkedWeeklyId:', note.linkedWeeklyId);

    if (currentWeekly) {
      const existingGoals = currentWeekly.goals ?? [];
      const newGoals = edited.goals.filter((g) => !existingGoals.includes(g));

      const existingFeedback = currentWeekly.mentoringFeedback ?? '';
      const newFeedback = edited.mentoringFeedback
        ? existingFeedback
          ? `${existingFeedback}\n\n---\n\n${edited.mentoringFeedback}`
          : edited.mentoringFeedback
        : existingFeedback;

      const existingCarry = currentWeekly.carryOver ?? [];
      const newCarry = edited.carryOver.filter((c) => !existingCarry.includes(c));

      // 할 일 → 미배정 (unassigned) 키로 추가
      const existingTasks = currentWeekly.memberTasks ?? {};
      const unassigned = existingTasks['unassigned'] ?? [];
      const newTaskItems = edited.tasks.map((text) => ({
        text,
        noteId: '',
        done: false,
      }));

      const patch = {
        goals: [...existingGoals, ...newGoals],
        mentoringFeedback: newFeedback,
        carryOver: [...existingCarry, ...newCarry],
        memberTasks: {
          ...existingTasks,
          unassigned: [...unassigned, ...newTaskItems],
        },
      };
      console.log('[요약반영] patch:', patch);
      const result = await editWeekly(currentWeekly.id, patch);
      console.log('[요약반영] editWeekly result:', result);
    } else {
      console.warn('[요약반영] currentWeekly가 없습니다! weeklies.length=', weeklies.length);
    }

    setSummaryResult(null);
    setSuccessMsg('✅ 요약 노트 생성 + 주간보드 반영 완료!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

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

      {/* 성공 메시지 */}
      {successMsg && (
        <div style={{
          background: '#10b981', color: '#fff', padding: '8px 16px',
          borderRadius: 'var(--radius-md)', marginBottom: 12,
          fontSize: 'var(--font-size-sm)', fontWeight: 600,
        }}>
          {successMsg}
        </div>
      )}

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

      {/* 제목 + 삭제 버튼 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
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
            flex: 1,
            paddingBottom: 8,
            background: 'transparent',
            letterSpacing: '-0.02em',
          }}
        />
        {!confirmDelete ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-priority-high)', whiteSpace: 'nowrap', marginTop: 4 }}
            onClick={() => setConfirmDelete(true)}
          >
            삭제
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', marginTop: 4 }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-priority-high)' }}>
              삭제?
            </span>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--color-priority-high)', color: '#fff', padding: '2px 8px' }}
              onClick={handleDelete}
            >
              확인
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
          </div>
        )}
      </div>

      {/* 편집 중인 사용자 표시 */}
      {activeEditors.length > 0 && (
        <div className="active-editors">
          {activeEditors.map((e) => (
            <span key={e.name} className="editor-avatar" style={{ background: e.color }}>
              {e.name.charAt(0)}
            </span>
          ))}
          <span className="editor-label">{activeEditors.map(e => e.name).join(', ')} 편집 중</span>
        </div>
      )}

      {/* 본문 — BlockNote 에디터 (실시간 협업) */}
      <BlockEditor
        initialContent={note.content}
        onChange={(json) => {
          setContent(json);
          save({ content: json });
        }}
        editorRef={editorRef}
        placeholder="내용을 작성하세요... (/ 로 명령어)"
        collaboration={currentMember ? {
          noteId: note.id,
          userName: currentMember.name,
          userColor: memberColor,
        } : undefined}
      />

      {/* 📎 요약하기 (회의록 전용) */}
      {isMeetingNote && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!confirmSummarize ? (
              <button
                className="btn btn-primary"
                onClick={() => setConfirmSummarize(true)}
                disabled={!canSummarize || summarizing}
                style={{ opacity: canSummarize ? 1 : 0.5 }}
              >
                {summarizing ? '⏳ 요약 중...' : '📎 요약하기'}
              </button>
            ) : (
              <>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  회의록을 요약하시겠습니까?
                </span>
                <button className="btn btn-primary btn-sm" onClick={handleSummarize}>
                  확인
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmSummarize(false)}>
                  취소
                </button>
              </>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowTranscript(!showTranscript)}
            >
              {showTranscript ? '🎙 녹음본 닫기' : '🎙 회의 녹음본 추가'}
            </button>
            {!canSummarize && content.length < 100 && (
              <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                100자 이상 작성 후 요약 가능 ({content.length}/100)
              </span>
            )}
          </div>
          {transcript && !showTranscript && (
            <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 6 }}>
              ✅ 녹음본 {transcript.length}자 첨부됨 — 요약 시 함께 분석됩니다
            </div>
          )}
          {showTranscript && (
            <div style={{ marginTop: 10 }}>
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>
                🎙 회의 녹음본 텍스트 (요약 시 함께 분석됩니다)
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="녹음본 텍스트를 여기에 붙여넣기..."
                rows={8}
                style={{
                  width: '100%',
                  fontSize: 'var(--font-size-sm)',
                  lineHeight: 1.6,
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  background: 'var(--color-bg-secondary)',
                }}
              />
            </div>
          )}
          {summaryError && (
            <div style={{ color: 'var(--color-priority-high)', fontSize: 'var(--font-size-sm)', marginTop: 8 }}>
              ❌ {summaryError}
            </div>
          )}
        </div>
      )}

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



      {/* 요약 미리보기 모달 */}
      {summaryResult && (
        <SummaryPreviewModal
          summary={summaryResult}
          onConfirm={handleSummaryConfirm}
          onCancel={() => setSummaryResult(null)}
        />
      )}
    </div>
  );
}
