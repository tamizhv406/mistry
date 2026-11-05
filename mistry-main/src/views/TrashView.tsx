import React, { useState } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  Filter,
  Layers,
  Search,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { TrashRecord, User } from '../db/types';
import { getCurrentUser } from '../services/auth';

interface TrashViewProps {
  onBack: () => void;
  onRestore: (item: TrashRecord) => void;
  onPermanentDelete: (item: TrashRecord) => void;
  onEmptyTrash: () => void;
  user?: User | null;
}

export const TrashView: React.FC<TrashViewProps> = ({
  onBack,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  user,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const currentUser = user || getCurrentUser();

  const trashItems = useLiveQuery(async () => {
    return await db.getAllTrash(currentUser || undefined);
  }, [currentUser]) || [];

  const filteredItems = trashItems.filter(item => {
    const matchesType = filterType === 'all' || item.tableName === filterType;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      item.entityType.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="main-wrapper">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <button className="btn btn-outline btn-sm" onClick={onBack} style={{ marginBottom: '8px' }}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={26} color="var(--primary)" />
            Trash / Recycle Bin
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Deleted records are safely kept here. Restore any item back to its site, or permanently delete it.
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            className="btn btn-danger"
            onClick={onEmptyTrash}
          >
            <AlertTriangle size={16} />
            <span>Empty Recycle Bin</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="search-filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search deleted records by name, site, supplier, or worker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="all">All Deleted Records ({trashItems.length})</option>
          <option value="sites">Sites</option>
          <option value="materials">Materials</option>
          <option value="rodEntries">Steel Rods</option>
          <option value="workers">Workers</option>
          <option value="attendance">Attendance</option>
          <option value="labourAdvances">Advances</option>
          <option value="salaryPayments">Salaries</option>
          <option value="tools">Tools</option>
          <option value="teaSnacksExpenses">Tea & Snacks</option>
          <option value="poojaExpenses">Pooja Expenses</option>
          <option value="electricityBills">Electricity</option>
          <option value="waterBills">Water</option>
          <option value="siteComments">Site Notes</option>
        </select>
      </div>

      {/* Trash Records Table */}
      <div className="table-container">
        <div className="table-header-bar">
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Recoverable Records ({filteredItems.length} items)
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            💡 Restored items immediately reappear in their respective site ledgers.
          </span>
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Type</th>
                <th>Record Title / Name</th>
                <th>Details & Site</th>
                <th>Amount</th>
                <th>Deleted On</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={`${item.tableName}-${item.id}`}>
                  <td>
                    <span className="badge badge-demo" style={{ fontSize: '0.75rem' }}>
                      {item.entityType}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.98rem' }}>{item.title}</strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    {item.subtitle}
                  </td>
                  <td>
                    {item.amount !== undefined ? (
                      <strong style={{ fontFamily: 'var(--font-heading)' }}>
                        ₹{item.amount.toLocaleString('en-IN')}
                      </strong>
                    ) : '-'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {new Date(item.deletedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => onRestore(item)}
                        title="Restore this record back to application"
                      >
                        <RotateCcw size={14} />
                        <span>Restore</span>
                      </button>

                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onPermanentDelete(item)}
                        title="Permanently erase record"
                      >
                        <Trash2 size={14} />
                        <span>Delete Permanently</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div className="empty-state" style={{ padding: '0' }}>
                      <div className="empty-icon-box">
                        <Trash2 size={32} />
                      </div>
                      <h4 className="empty-title">Recycle Bin is Empty</h4>
                      <p className="empty-desc">
                        {trashItems.length === 0
                          ? 'No deleted records found. When you delete sites, materials, workers or expenses, they will appear here safely for recovery.'
                          : 'No items match your filter criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
