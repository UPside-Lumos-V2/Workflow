import { useState } from 'react';
import { useDiscussions, useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { MemberAvatar } from './shared';

/** 간단 Markdown → HTML (bold, code, link, 줄바꿈) */
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:var(--color-bg-tertiary);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--color-status-open)">$1</a>')
    .replace(/\n/g, '<br />');
}

interface CaseDiscussionTabProps {
  caseId: string;
}

export function CaseDiscussionTab({ caseId }: CaseDiscussionTabProps) {
  const { byCaseId, add } = useDiscussions();
  const { items: members } = useMembers();
  const { currentMember } = useCurrentMember();
  const discussions = byCaseId(caseId);

  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !currentMember) return;
    setSubmitting(true);
    await add({
      caseId,
      taskId: null,
      authorId: currentMember.id,
      content: content.trim(),
    });
    setContent('');
    setSubmitting(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {discussions.length === 0 && (
        <div className="text-tertiary" style={{ textAlign: 'center', padding: '24px 0' }}>
          아직 코멘트가 없습니다
        </div>
      )}

      {/* 코멘트 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {discussions.map((d) => {
          const author = members.find((m) => m.id === d.authorId);
          return (
            <div key={d.id} style={{ display: 'flex', gap: 10 }}>
              {author && <MemberAvatar member={author} size="sm" />}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {author?.name ?? '알 수 없음'}
                  </span>
                  <span className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {formatTime(d.createdAt)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    lineHeight: 1.6,
                    background: 'var(--color-bg-secondary)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(d.content) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 입력 영역 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="코멘트를 남겨주세요"
          rows={2}
          style={{ flex: 1, minHeight: 60, resize: 'vertical' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) handleSubmit();
          }}
        />
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          style={{ height: 40 }}
        >
          전송
        </button>
      </div>
      <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>
        ⌘ + Enter로 전송
      </div>
    </div>
  );
}
