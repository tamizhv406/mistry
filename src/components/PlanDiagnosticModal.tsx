import React, { useState } from 'react';
import { Wrench, CheckCircle2, AlertTriangle, Info, X, ArrowRight, ShieldCheck } from 'lucide-react';
import type { PlanDiagnosticIssue, ValidatedPlanAction } from '../services/aiFloorPlanEngine';
import type { FloorPlanUnit } from '../db/types';

export interface PlanDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: PlanDiagnosticIssue[];
  unit: FloorPlanUnit;
  onApplyFix: (action: ValidatedPlanAction) => void;
  onApplyAllFixes: (actions: ValidatedPlanAction[]) => void;
}

export const PlanDiagnosticModal: React.FC<PlanDiagnosticModalProps> = ({
  isOpen,
  onClose,
  issues,
  unit,
  onApplyFix,
  onApplyAllFixes,
}) => {
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const activeIssues = issues.filter(i => !ignoredIds.has(i.id));
  const fixableActions = activeIssues
    .map(i => i.fixAction)
    .filter((a): a is ValidatedPlanAction => Boolean(a && a.action !== 'NOOP'));

  const handleIgnore = (id: string) => {
    setIgnoredIds(prev => new Set(prev).add(id));
  };

  const handleFixOne = (issue: PlanDiagnosticIssue) => {
    if (issue.fixAction) {
      onApplyFix(issue.fixAction);
      handleIgnore(issue.id);
    }
  };

  const handleFixAll = () => {
    onApplyAllFixes(fixableActions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Fix My Plan
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  {activeIssues.length} issues found
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review and resolve architectural geometry defects safely.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeIssues.length === 0 ? (
            <div className="py-12 text-center">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All Issues Resolved!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No open wall gaps, crooked angles, or invalid entities remain. Your floor plan geometry is clean and watertight.
              </p>
            </div>
          ) : (
            activeIssues.map(issue => (
              <div
                key={issue.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {issue.severity === 'critical' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      {issue.title}
                      <span className="text-[10px] text-slate-400 font-mono">at {issue.location}</span>
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {issue.description}
                    </p>
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                      Fix: {issue.suggestedFix}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {issue.fixAction && (
                    <button
                      onClick={() => handleFixOne(issue)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                    >
                      Fix
                    </button>
                  )}
                  <button
                    onClick={() => handleIgnore(issue.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Never silently changes anything. You retain total architectural control.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Close
            </button>
            {fixableActions.length > 1 && (
              <button
                onClick={handleFixAll}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Fix All {fixableActions.length} Issues
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
