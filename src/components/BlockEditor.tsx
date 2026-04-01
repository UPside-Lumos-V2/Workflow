import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { Block } from '@blocknote/core';
import * as Y from 'yjs';
import { SupabaseProvider } from '../lib/SupabaseProvider';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

interface CollaborationConfig {
  noteId: string;
  userName: string;
  userColor: string;
}

interface BlockEditorProps {
  initialContent?: string;
  onChange: (jsonString: string) => void;
  editorRef?: React.MutableRefObject<ReturnType<typeof useCreateBlockNote> | null>;
  placeholder?: string;
  minHeight?: number;
  collaboration?: CollaborationConfig;
}

export function BlockEditor({
  initialContent,
  onChange,
  editorRef,
  placeholder = '/ 를 입력하여 명령어를 확인하세요...',
  minHeight = 400,
  collaboration,
}: BlockEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerRef = useRef<SupabaseProvider | null>(null);

  // 기존 plain text 호환: JSON parse 시도
  const parsedContent = useMemo(() => {
    if (!initialContent) return undefined;
    try {
      const parsed = JSON.parse(initialContent);
      if (Array.isArray(parsed)) return parsed as Block[];
      return undefined;
    } catch {
      return undefined;
    }
  }, [initialContent]);

  // Yjs 문서 + Supabase Provider 생성 (collaboration 모드)
  const { doc, provider, fragment } = useMemo(() => {
    if (!collaboration) return { doc: null, provider: null, fragment: null };

    const ydoc = new Y.Doc();
    const yProvider = new SupabaseProvider(
      `note-${collaboration.noteId}`,
      ydoc
    );
    const yFragment = ydoc.getXmlFragment('document-store');

    return { doc: ydoc, provider: yProvider, fragment: yFragment };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaboration?.noteId]);

  // Provider ref 보관 + cleanup
  useEffect(() => {
    providerRef.current = provider;

    return () => {
      provider?.destroy();
      doc?.destroy();
    };
  }, [provider, doc]);

  // 에디터 생성 — collaboration 또는 standalone
  const editor = useCreateBlockNote(
    collaboration && provider && fragment
      ? {
          collaboration: {
            provider: provider as any, // SupabaseProvider extends Observable
            fragment,
            user: {
              name: collaboration.userName,
              color: collaboration.userColor,
            },
            showCursorLabels: 'activity' as const,
          },
        }
      : {
          initialContent: parsedContent,
          defaultStyles: true,
          uploadFile: undefined,
        }
  );

  // standalone 모드: plain text/markdown인 경우 비동기 로드
  useEffect(() => {
    if (collaboration) return;
    if (!parsedContent && initialContent && initialContent.trim().length > 0) {
      (async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
          if (blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks);
          }
        } catch (err) {
          console.warn('[BlockEditor] markdown parse failed:', err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // collaboration 모드: 초기 content를 Yjs에 주입 (첫 접속자만)
  useEffect(() => {
    if (!collaboration || !fragment) return;

    const timeout = setTimeout(async () => {
      if (fragment.length === 0 && initialContent && initialContent.trim().length > 0) {
        try {
          let blocks: Block[];
          try {
            blocks = JSON.parse(initialContent) as Block[];
          } catch {
            blocks = await editor.tryParseMarkdownToBlocks(initialContent);
          }
          if (blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks);
          }
        } catch (err) {
          console.warn('[BlockEditor] initial content injection failed:', err);
        }
      }
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaboration?.noteId]);

  // editorRef 노출
  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // 2초 debounced autosave
  const handleChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const json = JSON.stringify(editor.document);
      onChange(json);
    }, 2000);
  }, [editor, onChange]);

  return (
    <div
      className="blocknote-wrapper"
      style={{ minHeight, border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)' }}
    >
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={handleChange}
        data-placeholder={placeholder}
      />
    </div>
  );
}
