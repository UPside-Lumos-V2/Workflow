import { useState } from 'react';
import { useArtifacts } from '../hooks/useStore';
import { Modal } from './shared';
import type { ArtifactType } from '../types';

const TYPE_ICONS: Record<ArtifactType, string> = {
  link: '↗',
  code: '</>',
  file: '▣',
};

interface CaseArtifactsTabProps {
  caseId: string;
}

export function CaseArtifactsTab({ caseId }: CaseArtifactsTabProps) {
  const { byCaseId, add, remove } = useArtifacts();
  const artifacts = byCaseId(caseId);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<ArtifactType>('link');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => {
    setName('');
    setType('link');
    setUrl('');
    setContent('');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await add({
      caseId,
      taskId: null,
      name: name.trim(),
      type,
      url: url.trim(),
      content: content.trim(),
      description: description.trim(),
    });
    reset();
    setShowModal(false);
  };

  return (
    <div>
      {artifacts.length === 0 ? (
        <div className="text-tertiary" style={{ textAlign: 'center', padding: '24px 0' }}>
          아직 Artifact가 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {artifacts.map((a) => (
            <div key={a.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>{TYPE_ICONS[a.type]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-status-open)' }}>
                      {a.name}
                    </a>
                  ) : (
                    a.name
                  )}
                </div>
                {a.description && (
                  <div className="text-tertiary" style={{ fontSize: 'var(--font-size-xs)' }}>{a.description}</div>
                )}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => remove(a.id)}
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
        + Artifact 추가
      </button>

      <Modal
        isOpen={showModal}
        onClose={() => { reset(); setShowModal(false); }}
        title="Artifact 추가"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => { reset(); setShowModal(false); }}>취소</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!name.trim()}>추가</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">이름 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Etherscan TX 링크" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">타입</label>
          <select value={type} onChange={(e) => setType(e.target.value as ArtifactType)}>
            <option value="link">링크</option>
            <option value="code">코드</option>
            <option value="file">파일</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">URL</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        {type === 'code' && (
          <div className="form-group">
            <label className="form-label">코드 / 메모</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="코드 스니펫 또는 메모 내용"
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}
            />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">설명</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="간단한 설명" />
        </div>
      </Modal>
    </div>
  );
}
