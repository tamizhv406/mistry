import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History } from 'lucide-react';
import { db } from '../../db/db';
import type { LabourWorker } from '../../db/types';
import { buildCorrectionLog, correctionStatusLabel } from '../../domain/salary';
import { formatDateTime, formatDay } from '../../utils/datetime';

/**
 * Desktop correction log: every change to a saved attendance mark on the project (who, when,
 * which day, old → new, reason). Built with the same function as the phone screen.
 */
export const CorrectionLog: React.FC<{ siteId: string; workers: Pick<LabourWorker, 'id' | 'name'>[] }> = ({ siteId, workers }) => {
  // Removed marks too: clearing a mark is a correction.
  const marks = useLiveQuery(() => db.attendance.where('siteId').equals(siteId).toArray(), [siteId]);
  const entries = buildCorrectionLog(marks || [], workers);
  return (
    <div className="erp-section-card" id="attendance-correction-log" style={{ padding: 0 }}>
      <div className="erp-section-header">
        <div className="erp-section-title-wrap">
          <History size={20} className="erp-section-icon" />
          <div>
            <h3 className="erp-section-title">Correction log</h3>
            <p className="erp-section-subtitle" style={{ fontSize: 14 }}>Changes to attendance that was already saved, newest first.</p>
          </div>
        </div>
      </div>
      {entries.length === 0 ? (
        <p style={{ padding: '16px 22px', margin: 0, fontSize: 14, color: '#475569' }}>No corrections yet.</p>
      ) : (
        <div className="erp-table-responsive">
          <table className="erp-table" style={{ fontSize: 14 }}>
            <thead>
              <tr><th>Day</th><th>Worker</th><th>Change</th><th>Reason</th><th>Changed</th><th>By</th></tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.at}-${e.workerId}-${i}`} data-correction={`${e.workerId}:${e.date}`}>
                  <td>{formatDay(e.date)}</td>
                  <td><strong>{e.workerName}</strong></td>
                  <td>{correctionStatusLabel(e.from)} → {correctionStatusLabel(e.to)}</td>
                  <td>{e.reason || '—'}</td>
                  <td>{formatDateTime(e.at)}</td>
                  <td>{e.byName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
