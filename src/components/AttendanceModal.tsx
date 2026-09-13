import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Save } from 'lucide-react';
import { db } from '../db/db';
import type { LabourWorker, AttendanceStatus } from '../db/types';

interface AttendanceModalProps {
  isOpen: boolean;
  siteId: string;
  workers: LabourWorker[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface WorkerAttendanceState {
  status: AttendanceStatus;
  notes: string;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  siteId,
  workers,
  onClose,
  onSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceMap, setAttendanceMap] = useState<Record<string, WorkerAttendanceState>>({});
  const [loading, setLoading] = useState(false);

  // Load existing attendance for this date if present
  useEffect(() => {
    if (!isOpen || !siteId) return;

    async function loadDateAttendance() {
      const records = await db.attendance
        .where('siteId')
        .equals(siteId)
        .filter(a => !a.isDeleted && a.date === selectedDate)
        .toArray();

      const initial: Record<string, WorkerAttendanceState> = {};
      workers.forEach(w => {
        const found = records.find(r => r.workerId === w.id);
        if (found) {
          initial[w.id] = { status: found.status, notes: found.notes || '' };
        } else {
          // Default to Present
          initial[w.id] = { status: 'present', notes: '' };
        }
      });
      setAttendanceMap(initial);
    }

    loadDateAttendance();
  }, [isOpen, siteId, selectedDate, workers]);

  if (!isOpen) return null;

  const handleStatusChange = (workerId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        status,
      },
    }));
  };

  const handleNotesChange = (workerId: string, notes: string) => {
    setAttendanceMap(prev => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        notes,
      },
    }));
  };

  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, WorkerAttendanceState> = {};
    workers.forEach(w => {
      updated[w.id] = { status, notes: attendanceMap[w.id]?.notes || '' };
    });
    setAttendanceMap(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    const now = new Date().toISOString();

    try {
      // Find existing records for this site and date
      const existing = await db.attendance
        .where('siteId')
        .equals(siteId)
        .filter(a => !a.isDeleted && a.date === selectedDate)
        .toArray();

      const existingMap = new Map(existing.map(e => [e.workerId, e]));

      const toSave = workers.map(w => {
        const state = attendanceMap[w.id] || { status: 'present', notes: '' };
        const existingRecord = existingMap.get(w.id);

        let multiplier = 1.0;
        if (state.status === 'half_day') multiplier = 0.5;
        else if (state.status === 'absent') multiplier = 0;
        else if (state.status === 'overtime') multiplier = 1.5;

        return {
          id: existingRecord ? existingRecord.id : `att-${w.id}-${selectedDate}`,
          siteId,
          workerId: w.id,
          date: selectedDate,
          status: state.status,
          dayMultiplier: multiplier,
          notes: state.notes.trim(),
          isDeleted: false,
          createdAt: existingRecord ? existingRecord.createdAt : now,
          updatedAt: now,
        };
      });

      await db.attendance.bulkPut(toSave);
      onSuccess(`Attendance recorded for ${workers.length} workers on ${selectedDate}`);
      onClose();
    } catch (err: any) {
      alert('Failed to save attendance: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} color="#f59e0b" />
            Daily Attendance Register
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Date Picker & Quick Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-subtle)',
            padding: '12px 16px',
            borderRadius: '10px',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ width: 'auto' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ fontSize: '0.8rem' }}
                onClick={() => markAll('present')}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                style={{ fontSize: '0.8rem' }}
                onClick={() => markAll('half_day')}
              >
                Mark All 1/2 Day
              </button>
            </div>
          </div>

          {workers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No active workers added yet. Please add workers in the Labour tab first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto' }}>
              {workers.map(w => {
                const current = attendanceMap[w.id] || { status: 'present', notes: '' };
                return (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: '#ffffff',
                      border: '1.5px solid var(--border-light)',
                      borderRadius: '10px',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)' }}>
                        {w.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span className={`badge ${w.category === 'MISTRY' ? 'badge-demo' : w.category === 'PERIYAAL' ? 'badge-active' : 'badge-planning'}`} style={{ padding: '2px 6px', fontSize: '0.72rem' }}>
                          {w.category}
                        </span>
                        <span style={{ marginLeft: '6px' }}>₹{w.dailyWage}/day</span>
                      </div>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(w.id, 'present')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          backgroundColor: current.status === 'present' ? '#10b981' : '#f1f5f9',
                          color: current.status === 'present' ? '#ffffff' : '#475569',
                          border: current.status === 'present' ? '1px solid #059669' : '1px solid #cbd5e1',
                        }}
                      >
                        Present (1)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(w.id, 'half_day')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          backgroundColor: current.status === 'half_day' ? '#f59e0b' : '#f1f5f9',
                          color: current.status === 'half_day' ? '#ffffff' : '#475569',
                          border: current.status === 'half_day' ? '1px solid #d97706' : '1px solid #cbd5e1',
                        }}
                      >
                        1/2 Day (0.5)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(w.id, 'overtime')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          backgroundColor: current.status === 'overtime' ? '#8b5cf6' : '#f1f5f9',
                          color: current.status === 'overtime' ? '#ffffff' : '#475569',
                          border: current.status === 'overtime' ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                        }}
                      >
                        Overtime (1.5)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(w.id, 'absent')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          backgroundColor: current.status === 'absent' ? '#ef4444' : '#f1f5f9',
                          color: current.status === 'absent' ? '#ffffff' : '#475569',
                          border: current.status === 'absent' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        }}
                      >
                        Absent (0)
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Note (e.g. plastering, left 3pm)"
                      value={current.notes}
                      onChange={e => handleNotesChange(w.id, e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 10px', maxWidth: '180px' }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading || workers.length === 0}
          >
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
};
