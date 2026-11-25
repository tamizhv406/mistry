import React, { useState } from 'react';
import {
  BarChart3, Building2, Calculator, Check, ChevronDown, ChevronRight, Database, Download, HardHat, Home,
  LayoutGrid, LogIn, LogOut, MoreHorizontal, Package, PenTool, Plus, Settings, ShieldCheck, Trash2, Wallet, Wrench,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Site, User } from '../../db/types';
import { isAdmin, LOCAL_BUILDER_ID } from '../../services/auth';
import { SearchBox, Sheet } from './kit';
import { useLanguage } from '../../services/i18n';

interface ProjectSwitcherProps {
  sites: Site[];
  siteId: string | null;
  onSelectSite: (id: string) => void;
  onNewSite: () => void;
}

/**
 * The open project's name in the header. One tap opens the list of projects; a second tap
 * switches (or starts a new one).
 */
export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ sites, siteId, onSelectSite, onNewSite }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = sites.find(s => s.id === siteId);
  const q = query.trim().toLowerCase();
  const shown = q ? sites.filter(s => `${s.name} ${s.area} ${s.address} ${s.ownerName}`.toLowerCase().includes(q)) : sites;
  const close = () => { setOpen(false); setQuery(''); };

  return (
    <>
      <button type="button" id="project-switcher" className="pj-switch" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${t('nav_project', 'Project')}: ${current?.name || 'none'}. Change project`}>
        <Building2 size={18} className="pj-switch-icon" aria-hidden="true" />
        <span className="pj-switch-name">{current ? current.name : sites.length ? 'Choose project' : 'No project yet'}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      <Sheet open={open} title="Projects" onClose={close}
        footer={
          <button type="button" className="m-btn is-primary" onClick={() => { close(); onNewSite(); }}>
            <Plus size={20} /> New project
          </button>
        }
      >
        <div className="stk-screen">
          {sites.length > 5 && <div style={{ marginBottom: 10 }}><SearchBox value={query} onChange={setQuery} placeholder="Search projects" /></div>}
          {shown.length === 0 ? (
            <p className="is-muted" style={{ padding: '12px 0' }}>{sites.length ? 'No project matches your search.' : 'No projects yet.'}</p>
          ) : (
            <div className="m-card m-list">
              {shown.map(s => (
                <button key={s.id} type="button" className="m-row" onClick={() => { onSelectSite(s.id); close(); }} aria-current={s.id === siteId ? 'true' : undefined}>
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
        </div>
      </Sheet>
    </>
  );
};

interface NavProps {
  user: User;
  currentView: string;
  siteId: string | null;
  onNavigate: (view: string) => void;
  onOpenClassic: () => void;
  onLogout: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

/** Screens reached from More: the More tab shows as current on them. */
const MORE_VIEWS = ['expenses', 'reports', 'estimator', 'floor-plans', 'my-sites', 'site-detail', 'settings', 'backup', 'admin', 'trash'];

/**
 * Bottom navigation (phone only): five tabs, Home | Labour | Stock | Tools | More.
 * More opens a sheet with everything else.
 */
export const MobileBottomNav: React.FC<NavProps> = ({ user, currentView, onNavigate, onOpenClassic, onLogout, canInstall, onInstall, siteId }) => {
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const trashCount = useLiveQuery(async () => (await db.getAllTrash(user)).length, [user]) || 0;

  if (currentView === 'floor-plan-editor') return null;

  const tabs: { id: string; view: string; label: string; icon: React.ReactNode; match: string[] }[] = [
    { id: 'mobile-nav-home', view: 'dashboard', label: t('nav_home', 'Home'), icon: <Home size={22} />, match: ['dashboard'] },
    { id: 'mobile-nav-labour', view: 'labour', label: t('nav_labour', 'Labour'), icon: <HardHat size={22} />, match: ['labour', 'worker'] },
    { id: 'mobile-nav-stock', view: 'stock', label: t('nav_stock', 'Stock'), icon: <Package size={22} />, match: ['stock'] },
    { id: 'mobile-nav-tools', view: 'toolroom', label: t('nav_tools', 'Tools'), icon: <Wrench size={22} />, match: ['toolroom'] },
  ];

  const go = (view: string) => { setMoreOpen(false); onNavigate(view); };

  const items: { label: string; sub: string; icon: React.ReactNode; onClick: () => void; show?: boolean }[] = [
    { label: 'Expenses', sub: 'Tea, fuel, transport, bills', icon: <Wallet size={20} />, onClick: () => go('expenses') },
    { label: 'Building Calculator', sub: 'Estimate materials and cost', icon: <Calculator size={20} />, onClick: () => go('estimator') },
    { label: 'Floor Plans', sub: 'Draw and view plans in 3D', icon: <PenTool size={20} />, onClick: () => go('floor-plans') },
    { label: 'Reports', sub: 'Project cost and attendance summary', icon: <BarChart3 size={20} />, onClick: () => go('reports') },
    { label: 'Projects', sub: 'All projects, add or edit', icon: <Building2 size={20} />, onClick: () => go('my-sites') },
    { label: 'All Ledgers', sub: 'Steel rods, payments, notes and more', icon: <LayoutGrid size={20} />, onClick: () => { setMoreOpen(false); onOpenClassic(); }, show: !!siteId },
    { label: 'Backup & Sync', sub: 'Save or restore this device', icon: <Database size={20} />, onClick: () => go('backup') },
    { label: 'Settings', sub: 'Language, account and app settings', icon: <Settings size={20} />, onClick: () => go('settings') },
    { label: `Recycle Bin${trashCount ? ` (${trashCount})` : ''}`, sub: 'Restore deleted records', icon: <Trash2 size={20} />, onClick: () => go('trash') },
    { label: 'Admin Portal', sub: 'Users and audit log', icon: <ShieldCheck size={20} />, onClick: () => go('admin'), show: isAdmin(user) },
    { label: 'Install app', sub: 'Add Mistry to your home screen', icon: <Download size={20} />, onClick: () => { setMoreOpen(false); onInstall(); }, show: canInstall },
    ...(user.isLocal || user.id === LOCAL_BUILDER_ID
      ? [{ label: 'Connect Supabase Cloud', sub: 'Sign in to sync your projects online', icon: <LogIn size={20} />, onClick: () => go('login') }]
      : [{ label: 'Sign out', sub: user.fullName || user.username, icon: <LogOut size={20} />, onClick: () => { setMoreOpen(false); onLogout(); } }]
    ),
  ];

  return (
    <>
      <nav id="app-mobile-nav" className="m-nav no-print" aria-label="Main Navigation">
        {tabs.map(tab => (
          <button
            key={tab.view}
            id={tab.id}
            type="button"
            className="m-nav-btn"
            aria-current={tab.match.includes(currentView) ? 'page' : undefined}
            onClick={() => onNavigate(tab.view)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
        <button
          id="mobile-nav-more"
          type="button"
          className="m-nav-btn"
          aria-current={MORE_VIEWS.includes(currentView) ? 'page' : undefined}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={22} />
          <span>{t('nav_more', 'More')}</span>
        </button>
      </nav>

      <Sheet open={moreOpen} title={t('nav_more', 'More')} onClose={() => setMoreOpen(false)}>
        <div className="m-card m-list stk-screen">
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
