import { useState } from 'react';
import { useTasks, useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { MemberAvatar } from './shared';
import type { TaskLabel, TaskStatus } from '../types';

interface CaseTasksTabProps {
  caseId: string;
}

export function CaseTasksTab({ caseId }: CaseTasksTabProps) {
  const { byCaseId, add, edit, remove } = useTasks();
  const { items: members } = useMembers();
  const { currentMember } = useCurrentMember();
  const tasks = byCaseId(caseId);

  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    await add({
      caseId,
      title: newTitle.trim(),
      description: '',
      status: 'todo' as TaskStatus,
      label: '분석' as TaskLabel,
      assigneeId: currentMember?.id ?? null,
      sortOrder: tasks.length,
    });
    setNewTitle('');
    setAdding(false);
  };

  const cycleStatus = async (taskId: string, current: TaskStatus) => {
    const next: Record<TaskStatus, TaskStatus> = {
      'todo': 'in-progress',
      'in-progress': 'done',
      'done': 'todo',
    };
    await edit(taskId, { status: next[current] });
  };

  return (
    <div>
      {tasks.length === 0 && !adding && (
        <div className="text-tertiary" style={{ textAlign: 'center', padding: '24px 0' }}>
          아직 Task가 없습니다
        </div>
      )}

      {/* Task 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tasks.map((task) => {
          const assignee = members.find((m) => m.id === task.assigneeId);
          return (
            <div
              key={task.id}
              className="card"
              style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              {/* Status 클릭으로 전환 */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => cycleStatus(task.id, task.status)}
                title={`현재: ${task.status} (클릭하여 변경)`}
                style={{ padding: '2px 4px', fontSize: '16px' }}
              >
                {task.status === 'done' ? '■' : task.status === 'in-progress' ? '◧' : '□'}
              </button>

              {/* 제목 */}
              <span style={{
                flex: 1,
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                color: task.status === 'done' ? 'var(--color-text-tertiary)' : 'inherit',
              }}>
                {task.title}
              </span>

              {/* Label 선택 */}
              <select
                value={task.label}
                onChange={(e) => edit(task.id, { label: e.target.value as TaskLabel })}
                style={{
                  padding: '2px 6px',
                  fontSize: 'var(--font-size-xs)',
                  width: 70,
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <option value="분석">분석</option>
                <option value="개발">개발</option>
                <option value="조사">조사</option>
                <option value="운영">운영</option>
              </select>

              {/* Assignee 선택 */}
              <select
                value={task.assigneeId ?? ''}
                onChange={(e) => edit(task.id, { assigneeId: e.target.value || null })}
                style={{
                  padding: '2px 6px',
                  fontSize: 'var(--font-size-xs)',
                  width: 100,
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <option value="">미배정</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              {/* Assignee 아바타 */}
              {assignee && <MemberAvatar member={assignee} size="sm" />}

              {/* 삭제 */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => remove(task.id)}
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Task 추가 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="새 Task 제목"
          style={{ flex: 1 }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newTitle.trim()}>
          추가
        </button>
      </div>
    </div>
  );
}
