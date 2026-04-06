import { useEffect, useRef, useCallback, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { Block } from '@blocknote/core';
import * as Y from 'yjs';
import { SupabaseProvider } from '../lib/SupabaseProvider';
import { supabase } from '../lib/supabase';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

/** Supabase Storage에 파일 업로드 → public URL 반환 */
async function uploadToStorage(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');

  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `notes/${fileName}`;

  const { error } = await supabase.storage
    .from('lumos-uploads')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (error) {
    console.error('[uploadToStorage] upload failed:', error);
    // fallback: base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  const { data } = supabase.storage.from('lumos-uploads').getPublicUrl(filePath);
  return data.publicUrl;
}

/** 유효하지 않은 이미지 URL 블록 정리 (Notion attachment: 등) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeBlocks(blocks: any[]): any[] {
  const VALID_SCHEMES = ['http:', 'https:', 'data:'];
  return blocks
    .filter((block) => {
      // image 블록의 url이 invalid scheme이면 제거
      if (block.type === 'image' && block.props?.url) {
        try {
          const url = new URL(block.props.url);
          return VALID_SCHEMES.some((s) => url.protocol === s);
        } catch {
          // URL 파싱 자체가 실패하면 invalid → 제거
          return false;
        }
      }
      return true;
    })
    .map((block) => {
      // children이 있으면 재귀적으로 정리
      if (block.children?.length > 0) {
        return { ...block, children: sanitizeBlocks(block.children) };
      }
      return block;
    });
}

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

/**
 * 내부 wrapper: collaboration 모드에서 Provider가 준비된 후에만 에디터를 렌더링.
 * StrictMode 이중 실행 방어를 위해 useRef + useEffect 패턴 사용.
 */
function CollaborationEditor({
  collaboration,
  initialContent,
  onChange,
  editorRef: externalEditorRef,
  placeholder,
  minHeight,
}: BlockEditorProps & { collaboration: CollaborationConfig }) {
  const providerRef = useRef<SupabaseProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const fragmentRef = useRef<Y.XmlFragment | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Provider 준비 완료 플래그 (조건부 렌더링)
  const [ready, setReady] = useState(false);

  // ── StrictMode-safe: useEffect에서 Provider 생성 + cleanup 보장 ──
  useEffect(() => {
    const ydoc = new Y.Doc();
    const yProvider = new SupabaseProvider(`note-${collaboration.noteId}`, ydoc);
    const yFragment = ydoc.getXmlFragment('document-store');

    docRef.current = ydoc;
    providerRef.current = yProvider;
    fragmentRef.current = yFragment;
    setReady(true);

    return () => {
      setReady(false);
      yProvider.destroy();
      ydoc.destroy();
      docRef.current = null;
      providerRef.current = null;
      fragmentRef.current = null;
    };
  }, [collaboration.noteId]);

  // Provider가 준비되지 않으면 로딩 표시
  if (!ready || !providerRef.current || !fragmentRef.current) {
    return (
      <div
        style={{
          minHeight, border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)',
        }}
      >
        에디터 연결 중...
      </div>
    );
  }

  return (
    <CollaborationEditorInner
      provider={providerRef.current}
      fragment={fragmentRef.current}
      collaboration={collaboration}
      initialContent={initialContent}
      onChange={onChange}
      editorRef={externalEditorRef}
      placeholder={placeholder}
      minHeight={minHeight}
      debounceRef={debounceRef}
    />
  );
}

/** Provider가 준비된 후 실제 에디터를 렌더링하는 내부 컴포넌트 */
function CollaborationEditorInner({
  provider,
  fragment,
  collaboration,
  initialContent,
  onChange,
  editorRef: externalEditorRef,
  placeholder,
  minHeight,
  debounceRef,
}: {
  provider: SupabaseProvider;
  fragment: Y.XmlFragment;
  collaboration: CollaborationConfig;
  initialContent?: string;
  onChange: (jsonString: string) => void;
  editorRef?: React.MutableRefObject<ReturnType<typeof useCreateBlockNote> | null>;
  placeholder?: string;
  minHeight?: number;
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const editor = useCreateBlockNote({
    uploadFile: uploadToStorage,
    collaboration: {
      provider: provider as any,
      fragment,
      user: {
        name: collaboration.userName,
        color: collaboration.userColor,
      },
      showCursorLabels: 'activity' as const,
    },
  });

  // ── Fix 3: synced 이벤트 기반 초기 콘텐츠 주입 ──
  useEffect(() => {
    let cancelled = false;

    const injectInitial = async () => {
      if (cancelled || !initialContent || initialContent.trim().length === 0) return;
      if (fragment.length > 0) return; // 이미 다른 사용자의 데이터가 있음

      try {
        let blocks: Block[];
        try {
          blocks = JSON.parse(initialContent) as Block[];
        } catch {
          blocks = await editor.tryParseMarkdownToBlocks(initialContent);
        }
        if (blocks.length > 0 && fragment.length === 0) {
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch (err) {
        console.warn('[BlockEditor] initial content injection failed:', err);
      }
    };

    // synced 이벤트를 기다린 후 주입
    if (provider.synced) {
      injectInitial();
    } else {
      const handler = () => { injectInitial(); };
      provider.on('synced', handler);
      // 안전장치: 4초 후에도 synced 안 됐으면 fallback
      const fallback = setTimeout(() => { injectInitial(); }, 4000);
      return () => {
        cancelled = true;
        provider.off('synced', handler);
        clearTimeout(fallback);
      };
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaboration.noteId]);

  // editorRef 노출
  useEffect(() => {
    if (externalEditorRef) {
      externalEditorRef.current = editor;
    }
  }, [editor, externalEditorRef]);

  // ── Fix 4: synced 상태일 때만 autosave ──
  const handleChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // synced 전에는 DB 저장 스킵 → stale snapshot 방지
      if (!provider.synced) {
        console.log('[BlockEditor] skipping autosave (not synced yet)');
        return;
      }
      const json = JSON.stringify(sanitizeBlocks(editor.document));
      onChange(json);
    }, 2000);
  }, [editor, onChange, provider, debounceRef]);

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

/** 스탠드얼론 에디터 (협업 없이) */
function StandaloneEditor({
  initialContent,
  onChange,
  editorRef: externalEditorRef,
  placeholder,
  minHeight,
}: Omit<BlockEditorProps, 'collaboration'>) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedContent = (() => {
    if (!initialContent) return undefined;
    try {
      const parsed = JSON.parse(initialContent);
      if (Array.isArray(parsed)) return parsed as Block[];
      return undefined;
    } catch {
      return undefined;
    }
  })();

  const editor = useCreateBlockNote({
    initialContent: parsedContent,
    defaultStyles: true,
    uploadFile: uploadToStorage,
  });

  // plain text/markdown인 경우 비동기 로드
  useEffect(() => {
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

  // editorRef 노출
  useEffect(() => {
    if (externalEditorRef) {
      externalEditorRef.current = editor;
    }
  }, [editor, externalEditorRef]);

  // 2초 debounced autosave
  const handleChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const json = JSON.stringify(sanitizeBlocks(editor.document));
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

/** 메인 BlockEditor — collaboration 유무에 따라 분기 */
export function BlockEditor(props: BlockEditorProps) {
  if (props.collaboration) {
    return <CollaborationEditor {...props} collaboration={props.collaboration} />;
  }
  return <StandaloneEditor {...props} />;
}
