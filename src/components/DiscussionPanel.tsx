import { useState, useRef, useCallback, useMemo } from 'react';
import { useDiscussions, useMembers } from '../hooks/useStore';
import { useCurrentMember } from '../hooks/useCurrentMember';
import { MemberAvatar } from './shared';
import type { DiscussionContext, Discussion, DiscussionAttachment } from '../types';

/** 간단 Markdown → HTML (bold, code, link, 줄바꿈, 멘션) */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 멘션: @[name](memberId) → 보라색 배지
    .replace(/@\[(.+?)\]\([^)]+\)/g, '<span style="background:#9F34B4;color:#fff;padding:1px 6px;border-radius:10px;font-size:0.85em;font-weight:600">@$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:var(--color-bg-tertiary);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--color-status-open)">$1</a>')
    .replace(/\n/g, '<br />');
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface DiscussionPanelProps {
  contextType: DiscussionContext;
  contextId: string;
  contextLabel: string;
}

export function DiscussionPanel({ contextType, contextId, contextLabel }: DiscussionPanelProps) {
  const { byContext, add } = useDiscussions();
  const { items: members } = useMembers();
  const { currentMember } = useCurrentMember();

  const discussions = byContext(contextType, contextId);

  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<DiscussionAttachment[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 최상위 코멘트 (parentId === null)
  const topLevel = useMemo(
    () => discussions.filter((d) => !d.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [discussions]
  );

  // 답글 맵
  const repliesMap = useMemo(() => {
    const map: Record<string, Discussion[]> = {};
    discussions.forEach((d) => {
      if (d.parentId) {
        if (!map[d.parentId]) map[d.parentId] = [];
        map[d.parentId].push(d);
      }
    });
    // 각 답글 배열 정렬
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    return map;
  }, [discussions]);

  const handleSubmit = async () => {
    if (!content.trim() || !currentMember) return;
    setSubmitting(true);
    await add({
      contextType,
      contextId,
      contextLabel,
      authorId: currentMember.id,
      content: content.trim(),
      parentId: replyTo,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setContent('');
    setReplyTo(null);
    setAttachments([]);
    setSubmitting(false);
  };

  const toggleThread = (id: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 멘션: @ 감지
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // 커서 위치에서 @ 감지
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = useCallback((memberName: string, memberId: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    // @ 이전 위치 찾기
    const atIdx = textBefore.lastIndexOf('@');
    const newContent = textBefore.slice(0, atIdx) + `@[${memberName}](${memberId}) ` + textAfter;
    setContent(newContent);
    setShowMentions(false);
    setTimeout(() => textarea.focus(), 0);
  }, [content]);

  const filteredMembers = useMemo(
    () => members.filter((m) =>
      m.id !== currentMember?.id &&
      m.name.toLowerCase().includes(mentionFilter)
    ),
    [members, currentMember, mentionFilter]
  );

  // 파일 첨부
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert('파일 크기가 5MB를 초과합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((prev) => [...prev, {
        name: file.name,
        url: reader.result as string,
        type: file.type,
      }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getMember = (id: string) => members.find((m) => m.id === id);

  // 코멘트 렌더
  const renderComment = (d: Discussion, isReply = false) => {
    const author = getMember(d.authorId);
    const replies = repliesMap[d.id] ?? [];
    const isExpanded = expandedThreads.has(d.id);

    return (
      <div key={d.id} style={{ marginLeft: isReply ? 32 : 0, marginBottom: isReply ? 4 : 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {author && <MemberAvatar member={author} size="sm" />}
          <div style={{ flex: 1, minWidth: 0 }}>
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
                background: isReply ? 'var(--color-bg-tertiary, #F3F4F6)' : 'var(--color-bg-secondary)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                wordBreak: 'break-word',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(d.content) }}
            />
            {/* 첨부파일 */}
            {d.attachments && d.attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {d.attachments.map((a, i) => (
                  <div key={i} style={{
                    fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-tertiary, #F3F4F6)',
                    padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {a.type.startsWith('image/') ? (
                      <img src={a.url} alt={a.name} style={{ maxWidth: 120, maxHeight: 80, borderRadius: 4 }} />
                    ) : (
                      <>📎 {a.name}</>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* 답글 버튼 + 스레드 접기 */}
            {!isReply && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
                  onClick={() => { setReplyTo(d.id); textareaRef.current?.focus(); }}
                >
                  답글
                </button>
                {replies.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px', color: 'var(--color-text-tertiary)' }}
                    onClick={() => toggleThread(d.id)}
                  >
                    {isExpanded ? '▾' : '▸'} 답글 {replies.length}개
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* 답글 목록 */}
        {!isReply && isExpanded && replies.map((r) => renderComment(r, true))}
      </div>
    );
  };

  return (
    <div>
      {discussions.length === 0 && (
        <div className="text-tertiary" style={{ textAlign: 'center', padding: '24px 0' }}>
          아직 코멘트가 없습니다
        </div>
      )}

      {/* 코멘트 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
        {topLevel.map((d) => renderComment(d))}
      </div>

      {/* 답글 표시 */}
      {replyTo && (
        <div style={{
          fontSize: 'var(--font-size-xs)', padding: '4px 10px', marginBottom: 6,
          background: '#EEF2FF', borderRadius: 6, display: 'flex', justifyContent: 'space-between',
        }}>
          <span>↳ 답글 작성 중</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', fontSize: 11 }} onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* 입력 영역 */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              placeholder={replyTo ? '답글을 남겨주세요' : '코멘트를 남겨주세요 (@ 로 멘션)'}
              rows={2}
              style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) handleSubmit();
                if (e.key === 'Escape') { setShowMentions(false); setReplyTo(null); }
              }}
            />
            {/* 멘션 드롭다운 */}
            {showMentions && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                background: '#fff', border: '1px solid var(--color-border)',
                borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                maxHeight: 180, overflowY: 'auto', zIndex: 20, width: 200,
              }}>
                {filteredMembers.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m.name, m.id); }}
                  >
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', background: '#9F34B4',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>
                      {m.name.charAt(0)}
                    </span>
                    {m.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 파일 첨부 버튼 */}
          <button
            className="btn btn-ghost"
            style={{ height: 40, fontSize: 18, padding: '0 8px' }}
            onClick={() => fileInputRef.current?.click()}
            title="파일 첨부 (5MB 이하)"
          >
            📎
          </button>
          <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            style={{ height: 40 }}
          >
            전송
          </button>
        </div>

        {/* 첨부파일 미리보기 */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {attachments.map((a, i) => (
              <div key={i} style={{
                fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-secondary)',
                padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                📎 {a.name}
                <button className="btn btn-ghost btn-sm" style={{ padding: '0 2px', fontSize: 11 }} onClick={() => removeAttachment(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>
        ⌘ + Enter로 전송 · @ 멘션 · 📎 파일 첨부
      </div>
    </div>
  );
}
