import React, { useState } from 'react';
import {
  BarChart3, Building2, Calculator, CalendarCheck, Check, ChevronDown, ChevronRight, Database, Download, HardHat, Home,
  LayoutGrid, LogOut, Menu, Package, PenTool, Plus, ShieldCheck, Trash2, Wallet, Wrench,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Site, User } from '../../db/types';
import { isAdmin } from '../../services/auth';
import { SearchBox, Sheet } from './kit';

interface ChromeProps {
  user: User;
  currentView: string;
  sites: Site[];
  siteId: string | null;
  onSelectSite: (id: string) => void;
  onNavigate: (view: string) => void;
  onOpenClassic: () => void;
  onNewSite: () => void;
  onLogout: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

/** Slim top bar (phone only): brand, project switcher, account. */
export const MobileTopBar: React.FC<ChromeProps> = ({ user, sites, siteId, onSelectSite, onNavigate, onNewSite, onLogout }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = sites.find(s => s.id === siteId);
  const q = query.trim().toLowerCase();
  const shown = q ? sites.filter(s => `${s.name} ${s.area} ${s.address} ${s.ownerName}`.toLowerCase().includes(q)) : sites;

  return (
    <>
      <header className="m-topbar no-print">
        <button type="button" className="m-brand" onClick={() => onNavigate('dashboard')} aria-label="Mistry home">
          <HardHat size={20} strokeWidth={2.4} />
        </button>
        <button type="button" className="m-project-switch" onClick={() => setPickerOpen(true)} aria-haspopup="dialog">
          <span className="m-project-switch-text">
            <span className="m-project-switch-label">Project</span>
            <span className="m-project-switch-name">{current ? current.name : sites.length ? 'Choose project' : 'No project yet'}</span>
          </span>
          <ChevronDown size={18} className="is-muted" />
        </button>
        <button type="button" className="m-avatar" onClick={() => setAccountOpen(true)} aria-label="Account">
          {(user.fullName || user.username || 'U')[0].toUpperCase()}
        </button>
      </header>

      <Sheet open={pickerOpen} title="Projects" subtitle="Each project keeps its own records" onClose={() => setPickerOpen(false)}
        footer={
          <button type="button" className="m-btn is-primary" onClick={() => { setPickerOpen(false); onNewSite(); }}>
            <Plus size={20} /> New project
          </button>
        }
      >
        {sites.length > 5 && <div style={{ marginBottom: 10 }}><SearchBox value={query} onChange={setQuery} placeholder="Search projects" /></div>}
        {shown.length === 0 ? (
          <p className="is-muted" style={{ padding: '12px 0' }}>{sites.length ? 'No project matches your search.' : 'No projects yet.'}</p>
        ) : (
          <div className="m-card m-list">
            {shown.map(s => (
              <button key={s.id} type="button" className="m-row" onClick={() => { onSelectSite(s.id); setPickerOpen(false); setQuery(''); }}>
                <span className="m-row-icon"><Building2 size={20} /></span>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{s.name}</span>
                  <span className="m-row-sub">{s.area || s.address || s.buildingType} · {s.status}</span>
                </span>
                {s.id === siteId && <Check size={20} className="is-ok" aria-label="Current project" />}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={accountOpen} title={user.fullName || user.username} subtitle={`@${user.username}`} onClose={() => setAccountOpen(false)}>
        <div className="m-card m-list">
          <button type="button" className="m-row" onClick={() => { setAccountOpen(false); onNavigate('backup'); }}>
            <span className="m-row-icon"><Database size={20} /></span>
            <span className="m-row-main"><span className="m-row-title" style={{ display: 'block' }}>Backup &amp; Data</span><span className="m-row-sub">Save or restore everything on this device</span></span>
            <ChevronRight size={20} className="is-muted" />
          </button>
          <button type="button" className="m-row" onClick={() => { setAccountOpen(false); onLogout(); }}>
            <span className="m-row-icon"><LogOut size={20} /></span>
            <span className="m-row-main"><span className="m-row-title" style={{ display: 'block' }}>Sign out</span><span className="m-row-sub">Your data stays on this device</span></span>
          </button>
        </div>
      </Sheet>
    </>
  );
};

/** Bottom navigation (phone only): Home | Projects | Floor Plan | Reports | More. */
export const MobileBottomNav: React.FC<ChromeProps> = ({ user, currentView, onNavigate, onOpenClassic, onLogout, canInstall, onInstall, siteId }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const trashCount = useLiveQuery(async () => (await db.getAllTrash(user)).length, [user]) || 0;

  const tabs: { view: string; label: string; icon: React.ReactNode; match: string[] }[] = [
    { view: 'dashboard', label: 'Home', icon: <Home size={22} />, match: ['dashboard'] },
    { view: 'my-sites', label: 'Projects', icon: <Building2 size={22} />, match: ['my-sites'] },
    { view: 'floor-plans', label: 'Floor Plan', icon: <PenTool size={22} />, match: ['floor-plans', 'floor-plan-editor'] },
    { view: 'reports', label: 'Reports', icon: <BarChart3 size={22} />, match: ['reports'] },
  ];
  const moreActive = !tabs.some(t => t.match.includes(currentView));

  const go = (view: string) => { setMoreOpen(false); onNavigate(view); };

  const items: { label: string; sub: string; icon: React.ReactNode; onClick: () => void; show?: boolean }[] = [
    { label: 'Attendance & Salary', sub: 'Mark attendance, pay workers', icon: <CalendarCheck size={20} />, onClick: () => go('labour') },
    { label: 'Materials', sub: 'Purchases, usage and stock', icon: <Package size={20} />, onClick: () => go('stock') },
    { label: 'Tools', sub: 'Issue and return tools', icon: <Wrench size={20} />, onClick: () => go('toolroom') },
    { label: 'Expenses', sub: 'Tea, fuel, transport, bills', icon: <Wallet size={20} />, onClick: () => go('expenses') },
    { label: 'Building Calculator', sub: 'Estimate materials and cost', icon: <Calculator size={20} />, onClick: () => go('estimator') },
    { label: 'All ledgers', sub: 'Steel rods, payments, notes and more', icon: <LayoutGrid size={20} />, onClick: () => { setMoreOpen(false); onOpenClassic(); }, show: !!siteId },
    { label: 'Admin Portal', sub: 'Users and audit log', icon: <ShieldCheck size={20} />, onClick: () => go('admin'), show: isAdmin(user) },
    { label: `Recycle Bin${trashCount ? ` (${trashCount})` : ''}`, sub: 'Restore deleted records', icon: <Trash2 size={20} />, onClick: () => go('trash') },
    { label: 'Backup & Data', sub: 'Save or restore this device', icon: <Database size={20} />, onClick: () => go('backup') },
    { label: 'Install app', sub: 'Add Mistry to your home screen', icon: <Download size={20} />, onClick: () => { setMoreOpen(false); onInstall(); }, show: canInstall },
    { label: 'Sign out', sub: user.fullName || user.username, icon: <LogOut size={20} />, onClick: () => { setMoreOpen(false); onLogout(); } },
  ];

  return (
    <>
      <nav className="m-nav no-print" aria-label="Main">
        {tabs.map(t => (
          <button key={t.view} type="button" className="m-nav-btn" aria-current={t.match.includes(currentView) ? 'page' : undefined} onClick={() => onNavigate(t.view)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <button type="button" className="m-nav-btn" aria-current={moreActive ? 'page' : undefined} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <Menu size={22} />
          <span>More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="m-card m-list">
          {items.filter(i => i.show !== false).map(i => (
            <button key={i.label} type="button" className="m-row" onClick={i.onClick}>
              <span className="m-row-icon">{i.icon}</span>
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>{i.label}</span>
                <span className="m-row-sub">{i.sub}</span>
              </span>
              <ChevronRight size={20} className="is-muted" />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
};
