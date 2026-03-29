import { useState, useMemo, useEffect } from 'react';
import { useWeekly, useMembers, useCases } from '../hooks/useStore';
import { EmptyState } from '../components/shared';
import type { Weekly } from '../types';

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
}: {
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder: string;
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
          <span style={{ flex: 1 }}>{item}</span>
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

// ── 체크리스트 편집기 (완료 토글 지원) ──
// 규칙: "✓ " 접두사가 있으면 완료 상태
function ChecklistEditor({
  items,
  onUpdate,
  placeholder,
}: {
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder: string;
}) {
  const [newItem, setNewItem] = useState('');
  const isDone = (item: string) => item.startsWith('✓ ');
  const cleanText = (item: string) => item.replace(/^✓ /, '');

  const toggleDone = (idx: number) => {
    const updated = [...items];
    updated[idx] = isDone(updated[idx])
      ? cleanText(updated[idx])
      : `✓ ${updated[idx]}`;
    onUpdate(updated);
  };

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onUpdate([...items, newItem.trim()]);
    setNewItem('');
  };

  const handleRemove = (idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  };

  const doneCount = items.filter(isDone).length;

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} className="weekly-list-item" style={{ gap: 6 }}>
          <button
            onClick={() => toggleDone(idx)}
            style={{
              width: 18, height: 18, border: '2px solid var(--color-border)',
              borderRadius: 4, background: isDone(item) ? 'var(--color-text-primary)' : 'transparent',
              color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isDone(item) ? '✓' : ''}
          </button>
          <span style={{
            flex: 1,
            textDecoration: isDone(item) ? 'line-through' : 'none',
            color: isDone(item) ? 'var(--color-text-tertiary)' : 'inherit',
          }}>
            {cleanText(item)}
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
      {doneCount > 0 && items.length > 0 && (
        <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>
          {doneCount}/{items.length} 완료
        </div>
      )}
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

  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart());

  const rawWeekly = useMemo(
    () => weeklies.find((w) => w.weekStart === currentWeekStart),
    [weeklies, currentWeekStart],
  );

  const currentWeekly = useMemo(() => {
    if (!rawWeekly) return undefined;
    return {
      ...rawWeekly,
      goals: rawWeekly.goals ?? [],
      activeCaseIds: rawWeekly.activeCaseIds ?? [],
      memberTasks: (rawWeekly.memberTasks ?? {}) as Record<string, string[]>,
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
  const updateMemberTasks = (memberId: string, tasks: string[]) => {
    const updated = { ...currentWeekly?.memberTasks, [memberId]: tasks };
    update({ memberTasks: updated });
  };

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
            />
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
                      placeholder="할 일 입력"
                    />
                  </div>
                );
              })}
            </div>
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
