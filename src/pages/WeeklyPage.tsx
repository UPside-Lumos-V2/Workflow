import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeekly, useMembers, useCases, useNotes } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { EmptyState } from '../components/shared';
import type { Weekly, MemberTask } from '../types';

/** 월요일 기준 주 시작일 (ISO) */
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const weekNum = Math.ceil(((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  return `Week ${weekNum} (${fmt(start)} ~ ${fmt(end)})`;
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

// ── 인라인 리스트 편집기 ──
function ListEditor({
  items,
  onUpdate,
  placeholder,
  onItemClick,
}: {
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder: string;
  onItemClick?: (item: string) => void;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onUpdate([...items, newItem.trim()]);
    setNewItem('');
  };

  const handleRemove = (idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className="weekly-list-item">
          <span
            style={{ flex: 1, cursor: onItemClick ? 'pointer' : 'default' }}
            onClick={() => onItemClick?.(item)}
          >
            {item}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => handleRemove(idx)}
            style={{ color: 'var(--color-text-tertiary)', padding: '2px 6px' }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-secondary btn-sm" onClick={handleAdd} disabled={!newItem.trim()}>
          추가
        </button>
      </div>
    </div>
  );
}

// ── 체크리스트 편집기 (MemberTask 기반) ──
function ChecklistEditor({
  items,
  onUpdate,
  onAdd,
  onItemClick,
  onNoteClick,
  onRemove,
  placeholder,
  inputPrefix,
  onPrefixConsumed,
}: {
  items: MemberTask[];
  onUpdate: (items: MemberTask[]) => void;
  onAdd: (text: string) => void;
  onItemClick?: (task: MemberTask) => void;
  onNoteClick?: (task: MemberTask) => void;
  onRemove?: (task: MemberTask, idx: number) => void;
  placeholder: string;
  inputPrefix?: string;
  onPrefixConsumed?: () => void;
}) {
  const [newItem, setNewItem] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  // prefix가 외부에서 설정되면 input에 반영 + 스크롤 + 포커스
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (inputPrefix) {
      setNewItem(inputPrefix);
      onPrefixConsumed?.();
      // 다음 프레임에서 스크롤 + 포커스
      requestAnimationFrame(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputRef.current?.focus();
      });
    }
  }, [inputPrefix]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleDone = (idx: number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], done: !updated[idx].done };
    onUpdate(updated);
  };

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onAdd(newItem.trim());
    setNewItem('');
  };

  const executeRemove = (idx: number) => {
    onRemove?.(items[idx], idx);
    onUpdate(items.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  const doneCount = items.filter((t) => t.done).length;

  return (
    <div>
      {items.map((task, idx) => (
        <div key={idx} className="weekly-list-item" style={{ gap: 6 }}>
          <button
            onClick={() => toggleDone(idx)}
            style={{
              width: 18, height: 18, border: '2px solid var(--color-border)',
              borderRadius: 4, background: task.done ? 'var(--color-text-primary)' : 'transparent',
              color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {task.done ? '✓' : ''}
          </button>
          <span
            onClick={() => onItemClick?.(task)}
            style={{
              flex: 1,
              textDecoration: task.done ? 'line-through' : 'none',
              color: task.done ? 'var(--color-text-tertiary)' : 'inherit',
              cursor: onItemClick ? 'pointer' : 'default',
            }}
          >
            {task.text}
          </span>
          {onNoteClick && task.noteId && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNoteClick(task)}
              style={{ padding: '2px 6px', fontSize: 12 }}
              title="노트 열기"
            >
              📝
            </button>
          )}
          {confirmDeleteIdx === idx ? (
            <>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--color-priority-high)', color: '#fff', padding: '2px 6px', fontSize: 11 }}
                onClick={() => executeRemove(idx)}
              >
                삭제
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', fontSize: 11 }}
                onClick={() => setConfirmDeleteIdx(null)}
              >
                취소
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDeleteIdx(idx)}
              style={{ color: 'var(--color-text-tertiary)', padding: '2px 6px' }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {doneCount > 0 && items.length > 0 && (
        <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>
          {doneCount}/{items.length} 완료
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          ref={inputRef}
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-secondary btn-sm" onClick={handleAdd} disabled={!newItem.trim()}>
          추가
        </button>
      </div>
    </div>
  );
}

// ── Blur 저장 Textarea (로컬 state → blur 시 DB 저장) ──
function BlurSaveTextarea({
  value,
  onSave,
  placeholder,
  rows = 2,
}: {
  value: string;
  onSave: (val: string) => void;
  placeholder: string;
  rows?: number;
}) {
  const [local, setLocal] = useState(value);

  // 외부 value가 바뀌면 (다른 경로에서 업데이트) 로컬도 동기화
  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onSave(local);
      }}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

// ── 섹션 래퍼 ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="weekly-section">
      <h3 className="weekly-section-title">{title}</h3>
      {children}
    </section>
  );
}

export function WeeklyPage() {
  const { items: weeklies, add, edit } = useWeekly();
  const { items: members } = useMembers();
  const { items: cases } = useCases();
  const { add: addNote, remove: removeNote } = useNotes();
  const { currentMember } = useCurrentMember();
  const navigate = useNavigate();

  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart());

  const rawWeekly = useMemo(
    () => weeklies.find((w) => w.weekStart === currentWeekStart),
    [weeklies, currentWeekStart],
  );

  // 기존 string[] 데이터 → MemberTask[] 자동 마이그레이션
  const migrateTasks = (raw: unknown): MemberTask[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      if (typeof item === 'string') {
        // 레거시: "✓ 텍스트" or "텍스트"
        const done = item.startsWith('✓ ');
        return { text: item.replace(/^✓ /, ''), noteId: '', done };
      }
      return item as MemberTask;
    });
  };

  const currentWeekly = useMemo(() => {
    if (!rawWeekly) return undefined;
    const rawMT = (rawWeekly.memberTasks ?? {}) as Record<string, unknown[]>;
    const memberTasks: Record<string, MemberTask[]> = {};
    for (const [k, v] of Object.entries(rawMT)) {
      memberTasks[k] = migrateTasks(v);
    }
    return {
      ...rawWeekly,
      goals: rawWeekly.goals ?? [],
      activeCaseIds: rawWeekly.activeCaseIds ?? [],
      memberTasks,
      carryOver: rawWeekly.carryOver ?? [],
      mentoringAgenda: rawWeekly.mentoringAgenda ?? '',
      mentoringFeedback: rawWeekly.mentoringFeedback ?? '',
      mentoringActionItems: rawWeekly.mentoringActionItems ?? [],
    };
  }, [rawWeekly]);

  const handleCreate = async () => {
    await add({
      weekLabel: getWeekLabel(currentWeekStart),
      weekStart: currentWeekStart,
      goals: [],
      activeCaseIds: cases.filter((c) => c.status !== 'closed').map((c) => c.id),
      memberTasks: {},
      mentoringAgenda: '',
      mentoringFeedback: '',
      mentoringActionItems: [],
      carryOver: [],
    });
  };

  const update = (patch: Partial<Weekly>) => {
    if (currentWeekly) edit(currentWeekly.id, patch);
  };

  // 팀원별 할 일 업데이트
  const updateMemberTasks = (memberId: string, tasks: MemberTask[]) => {
    const updated = { ...currentWeekly?.memberTasks, [memberId]: tasks };
    update({ memberTasks: updated });
  };

  // 할 일 추가 + 노트 자동 생성
  const addMemberTask = async (memberId: string, text: string) => {
    const newNote = await addNote({
      title: text,
      content: '',
      status: 'draft',
      authorId: memberId, // 항상 해당 팀원이 작성자
      linkedCaseId: null,
      linkedWeeklyId: currentWeekly?.id ?? null,
      tags: ['할 일'],
    });
    const noteId = newNote?.id ?? '';
    const existing = currentWeekly?.memberTasks[memberId] ?? [];
    updateMemberTasks(memberId, [...existing, { text, noteId, done: false }]);
  };

  // 할 일 텍스트 클릭 → 현재 팀원의 input에 prefix 설정 (목표 클릭과 동일 동작)
  const handleTaskClick = (task: MemberTask) => {
    if (currentMember) {
      setGoalPrefix({ memberId: currentMember.id, text: `${task.text}: ` });
    }
  };

  // 📝 아이콘 클릭 → 노트로 이동
  const handleNoteClick = (task: MemberTask) => {
    if (task.noteId) navigate(`/app/notes/${task.noteId}`);
  };

  // 할 일 삭제 → 연결된 노트도 함께 삭제
  const handleTaskRemove = (task: MemberTask) => {
    if (task.noteId) {
      removeNote(task.noteId);
    }
  };

  // 목표 클릭 → 현재 선택된 팀원의 할 일 입력창에 prefix 설정
  const [goalPrefix, setGoalPrefix] = useState<{ memberId: string; text: string } | null>(null);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">주간 보드</h1>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 24,
      }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentWeekStart(shiftWeek(currentWeekStart, -1))}
        >
          이전 주
        </button>
        <span style={{ fontWeight: 600 }}>{getWeekLabel(currentWeekStart)}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentWeekStart(shiftWeek(currentWeekStart, 1))}
        >
          다음 주
        </button>
      </div>

      {!currentWeekly ? (
        <EmptyState
          message="이 주차의 기록이 없습니다"
          actionLabel="이번 주 시작하기"
          onAction={handleCreate}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── 이번 주 목표 ── */}
          <Section title="이번 주 목표">
            <ListEditor
              items={currentWeekly.goals}
              onUpdate={(goals) => update({ goals })}
              placeholder="목표 입력"
              onItemClick={(goal) => {
                if (currentMember) {
                  setGoalPrefix({ memberId: currentMember.id, text: `${goal}: ` });
                }
              }}
            />
            {currentWeekly.goals.length > 0 && (
              <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 6 }}>
                팁: 목표를 클릭하면 해당 목표의 할 일을 바로 추가할 수 있습니다
              </div>
            )}
          </Section>

          {/* ── 관련 케이스 (참조용) ── */}
          {currentWeekly.activeCaseIds.length > 0 && (
            <Section title="이번 주 관련 케이스">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {currentWeekly.activeCaseIds.map((caseId) => {
                  const c = cases.find((x) => x.id === caseId);
                  if (!c) return null;
                  return (
                    <span
                      key={caseId}
                      style={{
                        background: 'var(--color-bg-tertiary)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      {c.title}
                    </span>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── 팀원별 할 일 (케이스와 독립) ── */}
          <Section title="팀원별 할 일">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {members.map((member) => {
                const tasks = currentWeekly.memberTasks[member.id] ?? [];
                return (
                  <div key={member.id} className="card" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 'var(--font-size-sm)' }}>
                      {member.name}
                      {tasks.length > 0 && (
                        <span className="text-tertiary"> ({tasks.length})</span>
                      )}
                    </div>
                    <ChecklistEditor
                      items={tasks}
                      onUpdate={(updated) => updateMemberTasks(member.id, updated)}
                      onAdd={(text) => addMemberTask(member.id, text)}
                      onItemClick={handleTaskClick}
                      onNoteClick={handleNoteClick}
                      onRemove={handleTaskRemove}
                      placeholder="할 일 입력"
                      inputPrefix={goalPrefix?.memberId === member.id ? goalPrefix.text : undefined}
                      onPrefixConsumed={() => setGoalPrefix(null)}
                    />
                  </div>
                );
              })}
            </div>

            {/* 미배정 할 일 (LLM 요약에서 생성됨) */}
            {(() => {
              const unassigned = currentWeekly.memberTasks['unassigned'] ?? [];
              if (unassigned.length === 0) return null;
              return (
                <div className="card" style={{ padding: 14, marginTop: 12, opacity: 0.7, borderStyle: 'dashed' }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 'var(--font-size-sm)' }}>
                    📋 미배정 할 일
                    <span className="text-tertiary"> ({unassigned.length})</span>
                  </div>
                  <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 8 }}>
                    클릭하면 현재 선택된 팀원에게 배정됩니다
                  </div>
                  {unassigned.map((task, idx) => (
                    <div
                      key={idx}
                      className="weekly-list-item"
                      style={{
                        gap: 6, cursor: 'pointer',
                        opacity: 0.8,
                        transition: 'opacity 0.2s',
                      }}
                      onClick={() => {
                        if (!currentMember) return;
                        // 미배정에서 제거
                        const updatedUnassigned = unassigned.filter((_, i) => i !== idx);
                        // 해당 팀원에게 추가
                        const memberTasks = currentWeekly.memberTasks[currentMember.id] ?? [];
                        update({
                          memberTasks: {
                            ...currentWeekly.memberTasks,
                            unassigned: updatedUnassigned,
                            [currentMember.id]: [...memberTasks, task],
                          },
                        });
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.8'; }}
                    >
                      <span style={{ color: 'var(--color-text-tertiary)', marginRight: 4 }}>○</span>
                      <span style={{ flex: 1 }}>{task.text}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>

          {/* ── 멘토링 ── */}
          <Section title="멘토링">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">안건</label>
                <BlurSaveTextarea
                  value={currentWeekly.mentoringAgenda}
                  onSave={(val) => update({ mentoringAgenda: val })}
                  placeholder="멘토링 안건 입력"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label className="form-label">피드백</label>
                <BlurSaveTextarea
                  value={currentWeekly.mentoringFeedback}
                  onSave={(val) => update({ mentoringFeedback: val })}
                  placeholder="멘토링 피드백 기록"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label className="form-label">할 일 목록</label>
                <ListEditor
                  items={currentWeekly.mentoringActionItems}
                  onUpdate={(mentoringActionItems) => update({ mentoringActionItems })}
                  placeholder="할 일 입력"
                />
              </div>
            </div>
          </Section>

          {/* ── 다음 주 이월 ── */}
          <Section title="다음 주 이월">
            <ListEditor
              items={currentWeekly.carryOver}
              onUpdate={(carryOver) => update({ carryOver })}
              placeholder="이월 항목 입력"
            />
          </Section>
        </div>
      )}
    </div>
  );
}
