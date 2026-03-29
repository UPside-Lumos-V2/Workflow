import { useState } from 'react';
import { Modal } from './shared';
import type { Case, CasePriority } from '../types';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function CreateCaseModal({ isOpen, onClose, onSubmit }: CreateCaseModalProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [description, setDescription] = useState('');
  const [protocol, setProtocol] = useState('');
  const [chain, setChain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setPriority('medium');
    setDescription('');
    setProtocol('');
    setChain('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const metadata: Record<string, string> = {};
      if (protocol.trim()) metadata.protocol = protocol.trim();
      if (chain.trim()) metadata.chain = chain.trim();

      await onSubmit({
        title: title.trim(),
        status: 'active',
        priority,
        description: description.trim(),
        metadata,
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="새 케이스"
      actions={
        <>
          <button className="btn btn-secondary" onClick={handleClose}>취소</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting ? '생성 중...' : '생성'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="CrossCurve Flash Loan Exploit"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label">우선순위</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="간단한 설명..."
          rows={3}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Protocol</label>
          <input
            type="text"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            placeholder="Euler Finance"
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Chain</label>
          <input
            type="text"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            placeholder="Ethereum"
          />
        </div>
      </div>
    </Modal>
  );
}
