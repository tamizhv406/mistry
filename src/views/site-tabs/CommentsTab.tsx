import React, { useState } from 'react';
import { MessageSquare, PlusCircle, Search, Edit2, Trash2, Tag } from 'lucide-react';
import type { SiteComment } from '../../db/types';

interface CommentsTabProps {
  comments: SiteComment[];
  onOpenCommentModal: (comment?: SiteComment) => void;
  onDeleteComment: (comment: SiteComment) => void;
}

export const CommentsTab: React.FC<CommentsTabProps> = ({
  comments,
  onOpenCommentModal,
  onDeleteComment,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const filteredComments = comments.filter(c => {
    const matchesSearch = c.commentText.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Inspection': return 'badge-active';
      case 'Client Request': return 'badge-planning';
      case 'Material': return 'badge-onhold';
      case 'Delay': return 'badge-demo';
      case 'Safety': return 'badge-demo';
      default: return 'badge-completed';
    }
  };

  return (
    <div>
      {/* Search and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search site notes, engineer instructions, client requests..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="All">All Categories</option>
            <option value="General">General</option>
            <option value="Inspection">Inspection</option>
            <option value="Client Request">Client Request</option>
            <option value="Material">Material</option>
            <option value="Delay">Delay</option>
            <option value="Safety">Safety</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={() => onOpenCommentModal()}>
          <PlusCircle size={18} />
          <span>Add Site Note</span>
        </button>
      </div>

      {/* Notes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredComments.map(comment => (
          <div
            key={comment.id}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
              padding: '16px 20px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${getCategoryBadgeClass(comment.category)}`}>
                  {comment.category}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(comment.dateTime).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn-sm btn-outline"
                  title="Edit Note"
                  onClick={() => onOpenCommentModal(comment)}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  title="Move to Recycle Bin"
                  onClick={() => onDeleteComment(comment)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {comment.commentText}
            </p>
          </div>
        ))}

        {filteredComments.length === 0 && (
          <div className="table-container">
            <div className="empty-state">
              <div className="empty-icon-box">
                <MessageSquare size={32} />
              </div>
              <h4 className="empty-title">No Site Notes Found</h4>
              <p className="empty-desc">
                {search || selectedCategory !== 'All'
                  ? 'No notes match your filter or keyword.'
                  : 'Record important supervisor notes, owner instructions, site delays, or inspection stamps.'}
              </p>
              <button className="btn btn-primary" onClick={() => onOpenCommentModal()}>
                <PlusCircle size={16} />
                <span>Add First Note</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
