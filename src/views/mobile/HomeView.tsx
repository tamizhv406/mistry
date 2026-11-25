import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Building2, CalendarCheck, ChevronRight, Database, Package, Plus, Users, Wallet, Wrench,
} from 'lucide-react';
import { db } from '../../db/db';
import type { Site, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { buildDashboardSummary, projectDashboardInput } from '../../domain/dashboard';
import { formatStock } from '../../domain/stock';
import { formatDateTime, formatDayLong, todayKey } from '../../utils/datetime';
import { formatINR } from '../../utils/money';
import { loadDemoData } from '../../db/seedData';
import { useLanguage } from '../../services/i18n';
import { MaterialIcon } from '../../components/ui/CategoryIcon';
import { Empty, Page, Section, Sheet } from '../../components/mobile/kit';
import '../../styles/materials-mobile.css';

export type AppView = 'labour' | 'stock' | 'toolroom' | 'expenses' | 'reports' | 'floor-plans' | 'my-sites';
/** A screen to open with its form already started: the home screen's quick actions. */
export type QuickAction = 'purchase' | 'expense' | 'issue-tool';

interface HomeViewProps {
  user: User;
  /** undefined while the projects are still loading. */
  sites: Site[] | undefined;
  siteId: string | null;
  onGo: (view: AppView, action?: QuickAction) => void;
  onNewSite: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/** Placeholder blocks in the shape of the home screen, shown while the device database opens. */
export const HomeSkeleton: React.FC = () => (
  <div className="m-page stk-screen hm-screen" aria-busy="true" aria-label="Loading">
    <div className="hm-skel hm-skel-title" />
    <div className="hm-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="hm-skel hm-skel-card" />)}</div>
    <div className="hm-skel hm-skel-list" />
  </div>
);

export const HomeView: React.FC<HomeViewProps> = ({ user, sites, siteId, onGo, onNewSite, onNotify }) => {
  const { t } = useLanguage();
  const project = useProject(siteId);
  const catalog = useLiveQuery(() => db.catalogItems.toArray(), []);
  const today = todayKey();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [allActivity, setAllActivity] = useState(false);

  const summary = useMemo(
    () => (project && catalog ? buildDashboardSummary(projectDashboardInput(project, catalog), today) : null),
    [project, catalog, today],
  );

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemoData(user.id);
      onNotify('Sample project loaded. It is marked DEMO and can be removed from Backup & Data.', 'success');
    } catch (err) {
      onNotify('Could not load the sample project: ' + (err as Error).message, 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  if (sites === undefined) return <HomeSkeleton />;

  if (sites.length === 0) {
    const firstName = (user.fullName || user.username || '').split(' ')[0];
    return (
      <Page className="stk-screen hm-screen" title={`Welcome${firstName ? ', ' + firstName : ''}`} subtitle={formatDayLong(today)}>
        <div className="m-card">
          <Empty
            icon={<Building2 size={26} />}
            title="Start with your first project"
            action={
              <div style={{ display: 'grid', gap: 10 }}>
                <button type="button" className="m-btn is-primary is-block" onClick={onNewSite}>
                  <Plus size={20} /> New project
                </button>
                <button type="button" className="m-btn is-block" onClick={handleLoadDemo} disabled={loadingDemo}>
                  <Database size={18} /> {loadingDemo ? 'Loading…' : 'Try a sample project'}
                </button>
              </div>
            }
          >
            A project holds its own workers, materials, tools, expenses and floor plans.
          </Empty>
        </div>
      </Page>
    );
  }

  // The app always opens a project; while it (or the catalog) loads, keep the screen's shape.
  if (!project || !summary) return <HomeSkeleton />;

  const s = summary;
  const presentHint = s.workerCount === 0
    ? 'No workers yet'
    : s.notMarkedToday > 0
      ? t('hm_not_marked', '{n} not marked yet').replace('{n}', String(s.notMarkedToday))
      : t('hm_of_workers', 'of {n} workers').replace('{n}', String(s.workerCount));

  return (
    <Page className="stk-screen hm-screen" title={formatDayLong(today)}>
      {/* Today: who came, what was spent. */}
      <div className="hm-grid">
        <button type="button" className="hm-card is-ok" onClick={() => onGo('labour')}>
          <span className="hm-card-label">{t('hm_present', 'Present today')}</span>
          <span className="hm-card-value">{s.presentToday}</span>
          <span className={`hm-card-hint ${s.notMarkedToday > 0 && s.workerCount > 0 ? 'is-warn' : ''}`}>{presentHint}</span>
        </button>
        <button type="button" className="hm-card" onClick={() => onGo('expenses')}>
          <span className="hm-card-label">{t('hm_expenses', "Today's expenses")}</span>
          <span className="hm-card-value">{formatINR(s.todaysExpenses)}</span>
          <span className="hm-card-hint">{s.todaysExpenseCount ? t('hm_entries', '{n} entries').replace('{n}', String(s.todaysExpenseCount)) : 'Nothing yet'}</span>
        </button>
      </div>

      {/* Four quick actions, one tap each. */}
      <div className="hm-grid hm-actions">
        <button type="button" className="hm-action" onClick={() => onGo('labour')}>
          <span className="hm-action-icon is-green"><CalendarCheck size={22} /></span>{t('hm_attendance', 'Attendance')}
        </button>
        <button type="button" className="hm-action" onClick={() => onGo('stock', 'purchase')}>
          <span className="hm-action-icon is-amber"><Package size={22} /></span>{t('hm_material_in', 'Material arrived')}
        </button>
        <button type="button" className="hm-action" onClick={() => onGo('expenses', 'expense')}>
          <span className="hm-action-icon is-blue"><Wallet size={22} /></span>{t('hm_add_expense', 'Add expense')}
        </button>
        <button type="button" className="hm-action" onClick={() => onGo('toolroom', 'issue-tool')}>
          <span className="hm-action-icon is-teal"><Wrench size={22} /></span>{t('hm_give_tool', 'Give tool')}
        </button>
      </div>

      <div className="hm-grid">
        <button type="button" className={`hm-card ${s.lowStockCount > 0 ? 'is-bad' : ''}`} onClick={() => onGo('stock')}>
          <span className="hm-card-label">{t('hm_low_stock', 'Low stock')}</span>
          <span className="hm-card-value">{s.lowStockCount}</span>
          <span className="hm-card-hint">{s.lowStockCount ? `${s.lowStockCount} item${s.lowStockCount === 1 ? '' : 's'}` : t('hm_all_ok', 'All stock OK')}</span>
        </button>
        <button type="button" className={`hm-card ${s.toolsLate > 0 ? 'is-bad' : ''}`} onClick={() => onGo('toolroom')}>
          <span className="hm-card-label">{t('hm_tools_out', 'Tools out')}</span>
          <span className="hm-card-value">{s.toolsOut}</span>
          <span className="hm-card-hint">{s.toolsLate ? t('hm_late', '{n} late').replace('{n}', String(s.toolsLate)) : project.toolAssets.length ? `${project.toolAssets.length} in tool room` : 'No tools yet'}</span>
        </button>
      </div>

      {/* Salary still to pay, one line. */}
      <div className="m-card m-list hm-block">
        <button type="button" className="m-row" onClick={() => onGo('labour')}>
          <span className="m-row-icon"><Users size={20} /></span>
          <span className="m-row-main"><span className="m-row-title">{t('hm_pending_salary', 'Salary pending')}</span></span>
          <span className={`hm-row-amount ${s.pendingSalary > 0 ? 'is-bad' : ''}`}>{formatINR(s.pendingSalary)}</span>
          <ChevronRight size={20} className="is-muted" />
        </button>
      </div>

      {s.lowStockCount > 0 && (
        <Section
          title={t('hm_low_stock', 'Low stock')}
          action={<button type="button" className="m-link hm-link" onClick={() => onGo('stock')}>{t('hm_view_all', 'View all')} <ChevronRight size={16} /></button>}
        >
          <div className="m-card m-list">
            {s.lowStockTop.map(item => (
              <button key={item.key} type="button" className="m-row hm-stock-row" onClick={() => onGo('stock')}>
                <MaterialIcon category={item.category} name={item.name} />
                <span className="m-row-main"><span className="m-row-title">{item.name}</span></span>
                <span className="hm-row-amount is-bad">{formatStock(item.category, item.unit, item.onHand)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={t('hm_recent', 'Recent activity')}
        action={project.activity.length > s.recentActivity.length
          ? <button type="button" className="m-link hm-link" onClick={() => setAllActivity(true)}>{t('hm_view_all', 'View all')} <ChevronRight size={16} /></button>
          : undefined}
      >
        {s.recentActivity.length === 0 ? (
          <div className="m-card m-card-pad is-muted">{t('hm_no_activity', 'Activity will appear here as you record work.')}</div>
        ) : (
          <div className="m-card m-list">
            {s.recentActivity.map(a => (
              <div key={a.id} className="m-row hm-activity">
                <span className="m-row-main">
                  <span className="hm-activity-text">{a.description}</span>
                  <span className="m-row-sub">{formatDateTime(a.timestamp)}{a.userName ? ' · ' + a.userName : ''}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Sheet open={allActivity} title={t('hm_recent', 'Recent activity')} subtitle={project.site.name} onClose={() => setAllActivity(false)}>
        <div className="m-card m-list stk-screen">
          {project.activity.map(a => (
            <div key={a.id} className="m-row hm-activity">
              <span className="m-row-main">
                <span className="hm-activity-text">{a.description}</span>
                <span className="m-row-sub">{formatDateTime(a.timestamp)}{a.userName ? ' · ' + a.userName : ''}</span>
              </span>
            </div>
          ))}
        </div>
      </Sheet>
    </Page>
  );
};

