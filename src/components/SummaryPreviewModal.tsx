import { useState } from 'react';
import type { MeetingSummary } from '../types';

/** 편집 가능한 리스트 섹션 (모달 외부에 선언) */
function ListSection({
  title,
  items,
  onEdit,
  onRemove,
  onAdd,
  emptyMsg,
}: {
  title: string;
  items: string[];
  onEdit: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  emptyMsg: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
          {title} <span className="text-tertiary">({items.length})</span>
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onAdd}
          style={{ padding: '0 6px', fontSize: 14, lineHeight: 1, color: '#9F34B4' }}
          title="항목 추가"
        >
          +
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>{emptyMsg}</div>
      ) : (
        items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input
              type="text"
              value={item}
              onChange={(e) => onEdit(idx, e.target.value)}
              style={{ flex: 1, fontSize: 'var(--font-size-sm)', padding: '4px 8px' }}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onRemove(idx)}
              style={{ color: 'var(--color-text-tertiary)', padding: '2px 6px' }}
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * LLM 요약 결과 미리보기 + 수정 가능한 모달
 */
export function SummaryPreviewModal({
  summary,
  onConfirm,
  onCancel,
}: {
  summary: MeetingSummary;
  onConfirm: (edited: MeetingSummary) => void;
  onCancel: () => void;
}) {
  const [goals, setGoals] = useState(summary.goals);
  const [tasks, setTasks] = useState(summary.tasks);
  const [feedback, setFeedback] = useState(summary.mentoringFeedback);
  const [carryOver, setCarryOver] = useState(summary.carryOver);

  const makeEdit = (setter: (v: string[]) => void, list: string[]) => (idx: number, value: string) => {
    const updated = [...list];
    updated[idx] = value;
    setter(updated);
  };

  const makeRemove = (setter: (v: string[]) => void, list: string[]) => (idx: number) => {
    setter(list.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    onConfirm({
      goals,
      tasks,
      mentoringFeedback: feedback,
      carryOver,
    });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          width: '90%', maxWidth: 600, maxHeight: '80vh',
          overflow: 'auto', padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: 16, fontSize: 'var(--font-size-lg)' }}>
          📎 요약 결과 미리보기
        </h2>
        <div className="text-secondary" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 16 }}>
          각 항목을 수정하거나 삭제할 수 있습니다. 확인 후 "반영"을 누르세요.
        </div>

        <ListSection title="🎯 이번 주 목표" items={goals} onEdit={makeEdit(setGoals, goals)} onRemove={makeRemove(setGoals, goals)} onAdd={() => setGoals([...goals, ''])} emptyMsg="추출된 목표 없음" />
        <ListSection title="✅ 할 일 목록" items={tasks} onEdit={makeEdit(setTasks, tasks)} onRemove={makeRemove(setTasks, tasks)} onAdd={() => setTasks([...tasks, ''])} emptyMsg="추출된 할 일 없음" />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 'var(--font-size-sm)' }}>
            💬 멘토링 피드백
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
            placeholder="피드백 없음"
          />
        </div>

        <ListSection title="📦 이월 항목" items={carryOver} onEdit={makeEdit(setCarryOver, carryOver)} onRemove={makeRemove(setCarryOver, carryOver)} onAdd={() => setCarryOver([...carryOver, ''])} emptyMsg="이월 항목 없음" />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onCancel}>취소</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            ✅ 반영
          </button>
        </div>
      </div>
    </div>
  );
}
