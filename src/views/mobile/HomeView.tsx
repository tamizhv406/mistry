import React, { useMemo, useState } from 'react';
import {
  BarChart3, Building2, CalendarCheck, ChevronRight, Database, HardHat, LayoutGrid, Package, PenTool, Plus, Wallet, Wrench,
} from 'lucide-react';
import type { Site, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { buildSiteLabourSummary, countByStatus } from '../../domain/salary';
import { buildStock } from '../../domain/stock';
import { buildToolStatus } from '../../domain/toolTracking';
import { flattenExpenses, sumBy } from '../../domain/expenses';
import { formatDateTime, formatDay, formatDayLong, todayKey } from '../../utils/datetime';
import { formatINR, formatQty } from '../../utils/money';
import { loadDemoData } from '../../db/seedData';
import { Empty, Loading, Note, Page, Section, Stat } from '../../components/mobile/kit';

export type AppView = 'labour' | 'stock' | 'toolroom' | 'expenses' | 'reports' | 'floor-plans' | 'my-sites';

interface HomeViewProps {
  user: User;
  sites: Site[];
  siteId: string | null;
  onSelectSite: (id: string) => void;
  onGo: (view: AppView) => void;
  onOpenClassic: (siteId: string) => void;
  onNewSite: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ user, sites, siteId, onSelectSite, onGo, onOpenClassic, onNewSite, onNotify }) => {
  const project = useProject(siteId);
  const today = todayKey();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const derived = useMemo(() => {
    if (!project) return null;
    const todays = project.attendance.filter(a => a.date === today);
    const counts = countByStatus(todays);
    const marked = new Set(todays.map(a => a.workerId)).size;
    const labour = buildSiteLabourSummary(project.workers, project.attendance, project.advances, project.salaryPayments, { leavePaid: project.site.leavePaid });
    const stock = buildStock(project.materials, project.rodEntries, project.stockMovements);
    const expenses = flattenExpenses(project);
    const todaysExpenses = expenses.filter(e => e.date === today);
    const purchases = [...project.materials].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || '') || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
    const toolsOut = project.toolAssets.reduce((s, t) => s + buildToolStatus(t, project.toolIssues).issued, 0);
    return {
      counts, marked, labour, stock, purchases, toolsOut,
      todaysExpenseTotal: sumBy(todaysExpenses, e => e.amount),
      todaysExpenseCount: todaysExpenses.length,
      inStock: stock.filter(s => s.onHand > 0).length,
      negative: stock.filter(s => s.isNegative).length,
    };
  }, [project, today]);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemoData();
      onNotify('Sample project loaded. It is marked DEMO and can be removed from Backup & Data.', 'success');
    } catch (err) {
      onNotify('Could not load the sample project: ' + (err as Error).message, 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  const firstName = (user.fullName || user.username || '').split(' ')[0];

  if (sites.length === 0) {
    return (
      <Page title={`Welcome${firstName ? ', ' + firstName : ''}`} subtitle={formatDayLong(today)}>
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
            A project holds its own floor plans, workers, materials, tools and expenses.
          </Empty>
        </div>
      </Page>
    );
  }

  if (!siteId || project === null) {
    return (
      <Page title="Choose a project" subtitle={formatDayLong(today)}>
        <div className="m-card m-list">
          {sites.map(s => (
            <button key={s.id} type="button" className="m-row" onClick={() => onSelectSite(s.id)}>
              <span className="m-row-icon"><Building2 size={20} /></span>
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>{s.name}</span>
                <span className="m-row-sub">{s.area || s.address || s.buildingType} · {s.status}</span>
              </span>
              <ChevronRight size={20} className="is-muted" />
            </button>
          ))}
        </div>
      </Page>
    );
  }

  if (project === undefined || !derived) {
    return <Page title="Home" subtitle={formatDayLong(today)}><Loading rows={4} /></Page>;
  }

  const { site } = project;
  const notMarked = Math.max(0, project.workers.length - derived.marked);
  const otherSites = sites.filter(s => s.id !== site.id).slice(0, 3);

  return (
    <Page title={site.name} subtitle={<>{formatDayLong(today)} · {site.area || site.address || site.status}</>}>
      <button type="button" className="m-hero" onClick={() => onGo('floor-plans')}>
        <span className="m-hero-icon"><PenTool size={24} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="m-hero-title" style={{ display: 'block' }}>Floor Planner</span>
          <span className="m-hero-sub">Draw walls, rooms, doors and windows. View in 3D.</span>
        </span>
        <ChevronRight size={22} />
      </button>

      <Section
        title="Labour today"
        action={<button type="button" className="m-link" onClick={() => onGo('labour')}>Mark attendance <ChevronRight size={16} /></button>}
      >
        {project.workers.length === 0 ? (
          <div className="m-card m-card-pad is-muted" style={{ fontSize: '0.92rem' }}>
            No workers yet. Add workers to start marking attendance.
          </div>
        ) : (
          <>
            <div className="m-stats is-4">
              <Stat label="Present" value={derived.counts.present + derived.counts.overtime} tone="ok" onClick={() => onGo('labour')} />
              <Stat label="Half day" value={derived.counts.half_day} tone="warn" onClick={() => onGo('labour')} />
              <Stat label="Leave" value={derived.counts.leave} tone="info" onClick={() => onGo('labour')} />
              <Stat label="Absent" value={derived.counts.absent} tone="bad" onClick={() => onGo('labour')} />
            </div>
            {notMarked > 0 && (
              <div style={{ marginTop: 8 }}>
                <Note tone="warn">{notMarked} of {project.workers.length} workers not marked yet today.</Note>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Money">
        <div className="m-stats">
          <Stat
            label="Today's expenses"
            value={formatINR(derived.todaysExpenseTotal)}
            hint={derived.todaysExpenseCount ? `${derived.todaysExpenseCount} entr${derived.todaysExpenseCount === 1 ? 'y' : 'ies'}` : 'Nothing recorded'}
            onClick={() => onGo('expenses')}
          />
          <Stat
            label="Salary pending"
            value={formatINR(derived.labour.pending)}
            tone={derived.labour.pending > 0 ? 'bad' : 'ok'}
            hint="Earned − paid − advances"
            onClick={() => onGo('labour')}
          />
          <Stat
            label="Advances given"
            value={formatINR(derived.labour.recoverableAdvances)}
            hint="To be recovered from salary"
            onClick={() => onGo('labour')}
          />
          <Stat
            label="Paid ahead"
            value={formatINR(derived.labour.overpaid)}
            hint="Workers paid more than earned"
            onClick={() => onGo('labour')}
          />
        </div>
      </Section>

      <Section
        title="Materials"
        action={<button type="button" className="m-link" onClick={() => onGo('stock')}>Stock <ChevronRight size={16} /></button>}
      >
        <div className="m-card m-list">
          <button type="button" className="m-row" onClick={() => onGo('stock')}>
            <span className="m-row-icon"><Package size={20} /></span>
            <span className="m-row-main">
              <span className="m-row-title" style={{ display: 'block' }}>{derived.inStock} item{derived.inStock === 1 ? '' : 's'} in stock</span>
              <span className="m-row-sub">
                {derived.negative > 0 ? `${derived.negative} item${derived.negative === 1 ? '' : 's'} need checking` : 'Purchases, usage and returns'}
              </span>
            </span>
            <ChevronRight size={20} className="is-muted" />
          </button>
          {derived.purchases.map(p => (
            <div key={p.id} className="m-row">
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>{p.materialName}</span>
                <span className="m-row-sub">{formatQty(p.quantity)} {p.unit} · {formatDay(p.purchaseDate)}{p.supplier ? ' · ' + p.supplier : ''}</span>
              </span>
              <span className="m-row-end"><span className="m-row-amount">{formatINR(p.totalAmount)}</span></span>
            </div>
          ))}
          {derived.purchases.length === 0 && (
            <div className="m-row is-muted" style={{ fontSize: '0.9rem' }}>No purchases recorded yet.</div>
          )}
        </div>
      </Section>

      <Section title="Go to">
        <div className="m-action-grid">
          <button type="button" className="m-action" onClick={() => onGo('labour')}><span className="m-action-icon"><CalendarCheck size={22} /></span>Attendance</button>
          <button type="button" className="m-action" onClick={() => onGo('stock')}><span className="m-action-icon"><Package size={22} /></span>Materials</button>
          <button type="button" className="m-action" onClick={() => onGo('toolroom')}>
            <span className="m-action-icon"><Wrench size={22} /></span>Tools{derived.toolsOut > 0 ? ` (${derived.toolsOut} out)` : ''}
          </button>
          <button type="button" className="m-action" onClick={() => onGo('expenses')}><span className="m-action-icon"><Wallet size={22} /></span>Expenses</button>
          <button type="button" className="m-action" onClick={() => onGo('reports')}><span className="m-action-icon"><BarChart3 size={22} /></span>Reports</button>
          <button type="button" className="m-action" onClick={() => onGo('floor-plans')}><span className="m-action-icon"><PenTool size={22} /></span>Floor Plans</button>
          <button type="button" className="m-action" onClick={() => onGo('my-sites')}><span className="m-action-icon"><HardHat size={22} /></span>Projects</button>
          <button type="button" className="m-action" onClick={() => onOpenClassic(site.id)}><span className="m-action-icon"><LayoutGrid size={22} /></span>All ledgers</button>
        </div>
      </Section>

      <Section title="Recent activity">
        {project.activity.length === 0 ? (
          <div className="m-card m-card-pad is-muted" style={{ fontSize: '0.92rem' }}>Activity will appear here as you record work.</div>
        ) : (
          <div className="m-card m-list">
            {project.activity.slice(0, 6).map(a => (
              <div key={a.id} className="m-row" style={{ minHeight: 52 }}>
                <span className="m-row-main">
                  <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 600 }}>{a.description}</span>
                  <span className="m-row-sub">{formatDateTime(a.timestamp)}{a.userName ? ' · ' + a.userName : ''}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {otherSites.length > 0 && (
        <Section
          title="Other projects"
          action={<button type="button" className="m-link" onClick={() => onGo('my-sites')}>All <ChevronRight size={16} /></button>}
        >
          <div className="m-card m-list">
            {otherSites.map(s => (
              <button key={s.id} type="button" className="m-row" onClick={() => onSelectSite(s.id)}>
                <span className="m-row-icon"><Building2 size={20} /></span>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{s.name}</span>
                  <span className="m-row-sub">{s.area || s.address || s.buildingType} · {s.status}</span>
                </span>
                <ChevronRight size={20} className="is-muted" />
              </button>
            ))}
          </div>
        </Section>
      )}
    </Page>
  );
};
