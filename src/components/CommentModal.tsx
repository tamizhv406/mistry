import React, { useState, useEffect } from 'react';
import { X, Save, MessageSquare } from 'lucide-react';
import { db } from '../db/db';
import type { SiteComment } from '../db/types';
import { VoiceInputField } from './VoiceInputField';

interface CommentModalProps {
  isOpen: boolean;
  siteId: string;
  commentToEdit?: SiteComment | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const CATEGORIES: ('General' | 'Delay' | 'Material' | 'Client Request' | 'Inspection' | 'Safety')[] = [
  'General',
  'Material',
  'Client Request',
  'Inspection',
  'Delay',
  'Safety',
];

export const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  siteId,
  commentToEdit,
  onClose,
  onSuccess,
}) => {
  const [category, setCategory] = useState<'General' | 'Delay' | 'Material' | 'Client Request' | 'Inspection' | 'Safety'>('General');
  const [commentText, setCommentText] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (commentToEdit) {
      setCategory(commentToEdit.category);
      setCommentText(commentToEdit.commentText);
      setDateTime(commentToEdit.dateTime);
    } else {
      setCategory('General');
      setCommentText('');
      setDateTime(new Date().toISOString());
      setError('');
    }
  }, [commentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commentText.trim()) {
      setError('Please write your note or observation.');
      return;
    }

    const now = new Date().toISOString();
    const id = commentToEdit ? commentToEdit.id : `comment-${Date.now()}`;

    const record: SiteComment = {
      id,
      siteId,
      dateTime: dateTime || now,
      category,
      commentText: commentText.trim(),
      isDeleted: false,
      createdAt: commentToEdit ? commentToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.siteComments.put(record);
      onSuccess(commentToEdit ? 'Note updated successfully' : 'Site note recorded');
      onClose();
    } catch (err: any) {
      setError('Failed to save note: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={22} color="#f59e0b" />
            {commentToEdit ? 'Edit Site Note' : 'Add Site Note / Log'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Note Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <VoiceInputField
              label="Site Note / Observation"
              tamilLabel="தள குறிப்பு"
              type="textarea"
              rows={4}
              placeholder="Describe site progress, client instructions, quality inspections, delays or safety checks..."
              value={commentText}
              onChange={setCommentText}
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={18} />
              {commentToEdit ? 'Save Changes' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
