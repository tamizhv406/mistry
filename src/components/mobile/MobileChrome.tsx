import React, { useState } from 'react';
import {
  BarChart3, Building2, Calculator, CalendarCheck, Check, ChevronDown, ChevronRight, Database, Download, HardHat, Home,
  LayoutGrid, LogIn, LogOut, Menu, Package, PenTool, Plus, ShieldCheck, Trash2, Wallet, Wrench, Settings,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Site, User } from '../../db/types';
import { isAdmin } from '../../services/auth';
import { SearchBox, Sheet } from './kit';
import { useLanguage } from '../../services/i18n';

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
export const MobileTopBar: React.FC<ChromeProps> = ({ user, currentView, sites, siteId, onSelectSite, onNavigate, onNewSite, onLogout }) => {
  const { lang, setLang } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (currentView === 'floor-plan-editor') return null;

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

        {/* Mobile Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '6px', border: '1px solid #CBD5E1', marginLeft: 'auto', marginRight: '6px' }}>
          <button
            type="button"
            onClick={() => setLang('en')}
            style={{
              padding: '3px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: lang === 'en' ? '#FFFFFF' : 'transparent',
              color: lang === 'en' ? '#4F46E5' : '#64748B',
            }}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('ta')}
            style={{
              padding: '3px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: lang === 'ta' ? '#FFFFFF' : 'transparent',
              color: lang === 'ta' ? '#4F46E5' : '#64748B',
            }}
          >
            தமிழ்
          </button>
        </div>

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
          {user.id === 'local-builder-user' ? (
            <button type="button" className="m-row" onClick={() => { setAccountOpen(false); onNavigate('login'); }}>
              <span className="m-row-icon"><LogIn size={20} color="#0284c7" /></span>
              <span className="m-row-main"><span className="m-row-title" style={{ display: 'block' }}>Connect Supabase Cloud</span><span className="m-row-sub">Sign in to sync your projects online</span></span>
              <ChevronRight size={20} className="is-muted" />
            </button>
          ) : (
            <button type="button" className="m-row" onClick={() => { setAccountOpen(false); onLogout(); }}>
              <span className="m-row-icon"><LogOut size={20} /></span>
              <span className="m-row-main"><span className="m-row-title" style={{ display: 'block' }}>Sign out</span><span className="m-row-sub">Your data stays on this device</span></span>
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
};

/**
 * Bottom navigation (phone only): one flat, compact bar with five equal tabs,
 * Home | Projects | Floor Plan | Reports | More.
 */
export const MobileBottomNav: React.FC<ChromeProps> = ({ user, currentView, onNavigate, onOpenClassic, onLogout, canInstall, onInstall, siteId }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const trashCount = useLiveQuery(async () => (await db.getAllTrash(user)).length, [user]) || 0;

  if (currentView === 'floor-plan-editor') return null;

  const tabs: { id: string; view: string; label: string; icon: React.ReactNode; match: string[] }[] = [
    { id: 'mobile-nav-home', view: 'dashboard', label: 'Home', icon: <Home size={20} />, match: ['dashboard'] },
    { id: 'mobile-nav-projects', view: 'my-sites', label: 'Projects', icon: <Building2 size={20} />, match: ['my-sites', 'site-detail'] },
    { id: 'mobile-nav-attendance', view: 'labour', label: 'Attendance', icon: <HardHat size={20} />, match: ['labour', 'worker'] },
    { id: 'mobile-nav-planner', view: 'floor-plans', label: 'Floor Plan', icon: <PenTool size={20} />, match: ['floor-plans', 'floor-plan-editor'] },
    { id: 'mobile-nav-calculator', view: 'estimator', label: 'Calculator', icon: <Calculator size={20} />, match: ['estimator'] },
    { id: 'mobile-nav-settings', view: 'settings', label: 'Settings', icon: <Settings size={20} />, match: ['settings', 'backup', 'admin', 'trash'] },
  ];

  const go = (view: string) => { setMoreOpen(false); onNavigate(view); };

  const items: { label: string; sub: string; icon: React.ReactNode; onClick: () => void; show?: boolean }[] = [
    { label: 'Attendance & Salary', sub: 'Mark attendance, pay workers', icon: <CalendarCheck size={20} />, onClick: () => go('labour') },
    { label: 'Materials & Inventory', sub: 'Purchases, usage and stock', icon: <Package size={20} />, onClick: () => go('stock') },
    { label: 'Tools Management', sub: 'Issue and return tools', icon: <Wrench size={20} />, onClick: () => go('toolroom') },
    { label: 'Expenses Ledger', sub: 'Tea, fuel, transport, bills', icon: <Wallet size={20} />, onClick: () => go('expenses') },
    { label: 'Reports & Analytics', sub: 'Project cost and attendance summary', icon: <BarChart3 size={20} />, onClick: () => go('reports') },
    { label: 'Building Calculator', sub: 'Estimate materials and cost', icon: <Calculator size={20} />, onClick: () => go('estimator') },
    { label: 'All Ledgers', sub: 'Steel rods, payments, notes and more', icon: <LayoutGrid size={20} />, onClick: () => { setMoreOpen(false); onOpenClassic(); }, show: !!siteId },
    { label: 'Admin Portal', sub: 'Users and audit log', icon: <ShieldCheck size={20} />, onClick: () => go('admin'), show: isAdmin(user) },
    { label: `Recycle Bin${trashCount ? ` (${trashCount})` : ''}`, sub: 'Restore deleted records', icon: <Trash2 size={20} />, onClick: () => go('trash') },
    { label: 'Backup & Sync', sub: 'Save or restore this device', icon: <Database size={20} />, onClick: () => go('backup') },
    { label: 'Install app', sub: 'Add Mistry to your home screen', icon: <Download size={20} />, onClick: () => { setMoreOpen(false); onInstall(); }, show: canInstall },
    ...(user.id === 'local-builder-user'
      ? [{ label: 'Connect Supabase Cloud', sub: 'Sign in to sync your projects online', icon: <LogIn size={20} />, onClick: () => go('login') }]
      : [{ label: 'Sign out', sub: user.fullName || user.username, icon: <LogOut size={20} />, onClick: () => { setMoreOpen(false); onLogout(); } }]
    ),
  ];

  return (
    <>
      <nav id="app-mobile-nav" className="m-nav no-print" aria-label="Main Navigation">
        {tabs.map(t => (
          <button
            key={t.view}
            id={t.id}
            type="button"
            className="m-nav-btn"
            aria-current={t.match.includes(currentView) ? 'page' : undefined}
            aria-label={t.label}
            onClick={() => onNavigate(t.view)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
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
