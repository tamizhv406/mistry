import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, IndianRupee, Users, Wallet } from 'lucide-react';
import type { ActivityLog } from '../db/types';
import type { DashboardSummary } from '../domain/dashboard';
import { formatStock } from '../domain/stock';
import { formatDateTime } from '../utils/datetime';
import { formatINR } from '../utils/money';
import { useLanguage } from '../services/i18n';
import { MaterialIcon } from './ui/CategoryIcon';

interface Props {
  summary: DashboardSummary;
  /** Older activity, shown under "View all". */
  activity: ActivityLog[];
  scopeName: string;
  onNavigate?: (view: string) => void;
}

/**
 * Desktop dashboard: today's numbers for the selected project (or all projects). Uses the same
 * summary as the phone Home screen (domain/dashboard.ts), so both show the same values.
 */
export const DashboardToday: React.FC<Props> = ({ summary: s, activity, scopeName, onNavigate }) => {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const go = (view: string) => onNavigate?.(view);
  const rows = showAll ? activity : s.recentActivity;

  const tiles: { id: string; label: string; value: string; hint: string; tone?: 'ok' | 'bad'; icon: React.ReactNode; view: string }[] = [
    {
      id: 'present', label: t('hm_present', 'Present today'), value: String(s.presentToday), view: 'labour', tone: 'ok', icon: <Users size={18} />,
      hint: s.workerCount ? `of ${s.workerCount} workers${s.notMarkedToday ? ` · ${s.notMarkedToday} not marked` : ''}` : 'No workers yet',
    },
    {
      id: 'expenses', label: t('hm_expenses', "Today's expenses"), value: formatINR(s.todaysExpenses), view: 'expenses', icon: <IndianRupee size={18} />,
      hint: s.todaysExpenseCount ? `${s.todaysExpenseCount} entr${s.todaysExpenseCount === 1 ? 'y' : 'ies'}` : 'Nothing yet',
    },
    {
      id: 'low', label: t('hm_low_stock', 'Low stock'), value: String(s.lowStockCount), view: 'stock', tone: s.lowStockCount ? 'bad' : undefined, icon: <AlertTriangle size={18} />,
      hint: s.lowStockCount ? 'At or below the low-stock level' : t('hm_all_ok', 'All stock OK'),
    },
    {
      id: 'salary', label: t('hm_pending_salary', 'Salary pending'), value: formatINR(s.pendingSalary), view: 'labour', tone: s.pendingSalary > 0 ? 'bad' : undefined, icon: <Wallet size={18} />,
      hint: 'Earned − paid − advances',
    },
  ];

  return (
    <section className="dt-today" id="dashboard-today" aria-label={`Today · ${scopeName}`}>
      <div className="dt-head">
        <h3>Today · {scopeName}</h3>
      </div>
      <div className="dt-tiles">
        {tiles.map(tile => (
          <button key={tile.id} type="button" className={`dt-tile ${tile.tone ? `is-${tile.tone}` : ''}`} data-metric={tile.id} onClick={() => go(tile.view)}>
            <span className="dt-tile-label">{tile.icon}{tile.label}</span>
            <strong className="dt-tile-value">{tile.value}</strong>
            <span className="dt-tile-hint">{tile.hint}</span>
          </button>
        ))}
      </div>

      <div className="dt-lists">
        <div className="dt-list">
          <div className="dt-list-head">
            <h4>{t('hm_low_stock', 'Low stock')}</h4>
            {s.lowStockCount > 0 && <button type="button" className="dt-link" onClick={() => go('stock')}>{t('hm_view_all', 'View all')} <ChevronRight size={16} /></button>}
          </div>
          {s.lowStockTop.length === 0 ? (
            <p className="dt-empty"><CheckCircle2 size={18} /> {t('hm_all_ok', 'All stock OK')}</p>
          ) : s.lowStockTop.map(item => (
            <div key={`${item.siteId}-${item.key}`} className="dt-row" data-low-stock={item.name}>
              <MaterialIcon category={item.category} name={item.name} />
              <span className="dt-row-main">{item.name}</span>
              <strong className="dt-row-end is-bad">{formatStock(item.category, item.unit, item.onHand)}</strong>
            </div>
          ))}
        </div>

        <div className="dt-list">
          <div className="dt-list-head">
            <h4>{t('hm_recent', 'Recent activity')}</h4>
            {activity.length > s.recentActivity.length && (
              <button type="button" className="dt-link" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show less' : t('hm_view_all', 'View all')} <ChevronRight size={16} /></button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="dt-empty">{t('hm_no_activity', 'Activity will appear here as you record work.')}</p>
          ) : rows.map(a => (
            <div key={a.id} className="dt-row" data-activity={a.id}>
              <span className="dt-row-main">
                <span className="dt-activity">{a.description}</span>
                <span className="dt-sub">{formatDateTime(a.timestamp)}{a.siteName ? ` · ${a.siteName}` : ''}{a.userName ? ` · ${a.userName}` : ''}</span>
              </span>
              {typeof a.amount === 'number' && <strong className="dt-row-end">{formatINR(a.amount)}</strong>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
