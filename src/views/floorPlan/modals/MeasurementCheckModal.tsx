import React from 'react';
import { Sheet, Note } from '../../../components/mobile/kit';
import { baseUnitOf } from '../../../domain/planGeometry';
import { formatDimension } from '../../../domain/planMeasure';
import { formatMm, type AlignmentIssue } from '../../../domain/planEdit';
import type { FloorPlanUnit } from '../../../db/types';

export interface MeasurementCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  alignmentIssues: AlignmentIssue[];
  unit: FloorPlanUnit;
  onApplyFix: (issue: AlignmentIssue, choiceIndex: 0 | 1) => void;
  onShowIssue: (issue: AlignmentIssue) => void;
  onIgnoreIssue: (issueId: string) => void;
}

export const MeasurementCheckModal: React.FC<MeasurementCheckModalProps> = ({
  isOpen,
  onClose,
  alignmentIssues,
  unit,
  onApplyFix,
  onShowIssue,
  onIgnoreIssue,
}) => {
  return (
    <Sheet
      open={isOpen}
      title="Measurement check"
      subtitle={
        alignmentIssues.length
          ? `${alignmentIssues.length} small difference${alignmentIssues.length === 1 ? '' : 's'} found`
          : 'No small differences'
      }
      onClose={onClose}
    >
      {alignmentIssues.length === 0 ? (
        <Note tone="ok">The walls line up. No measurements are a few millimetres apart.</Note>
      ) : (
        <div className="fp-checks" id="fp-checks">
          <p className="m-calc-note" style={{ marginTop: 0 }}>
            These measurements are a few millimetres apart, where they are probably meant to be the same. Pick the measurement that is right. Nothing changes until you do.
          </p>
          {alignmentIssues.map(issue => {
            const show = (m: { value: number; mm: number }) =>
              baseUnitOf(unit) === 'feet' ? `${formatDimension(m.value, unit)} (${formatMm(m.mm)})` : formatMm(m.mm);
            return (
              <div key={issue.id} className="fp-check" data-check-id={issue.id}>
                <div className="fp-check-title">
                  {issue.kind === 'step'
                    ? `Two walls are ${formatMm(issue.differenceMm)} out of line`
                    : `A wall is ${formatMm(issue.differenceMm)} out of straight`}
                </div>
                <div className="fp-check-ref">Measured from {issue.reference}</div>
                <dl className="fp-check-values">
                  {issue.measurements.map((m: { label: string; value: number; mm: number }) => (
                    <div key={m.label}><dt>{m.label}</dt><dd>{show(m)}</dd></div>
                  ))}
                  <div className="is-diff"><dt>Difference</dt><dd>{formatMm(issue.differenceMm)}</dd></div>
                </dl>
                <div className="fp-check-actions">
                  {([0, 1] as const).map(k => (
                    <button
                      key={k}
                      type="button"
                      className="m-btn is-small is-primary"
                      onClick={() => onApplyFix(issue, k)}
                    >
                      Use {formatMm(issue.measurements[k].mm)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="m-btn is-small"
                    onClick={() => onShowIssue(issue)}
                  >
                    Show
                  </button>
                  <button
                    type="button"
                    className="m-btn is-small"
                    onClick={() => onIgnoreIssue(issue.id)}
                  >
                    Keep as drawn
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
};
