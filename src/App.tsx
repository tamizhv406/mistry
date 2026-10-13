import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, X, Download } from 'lucide-react';
import { db } from './db/db';
import { MobileTopBar, MobileBottomNav } from './components/mobile/MobileChrome';
import { HomeView } from './views/mobile/HomeView';
import { LabourView } from './views/mobile/LabourView';
import { WorkerProfileView } from './views/mobile/WorkerProfileView';
import { StockView } from './views/mobile/StockView';
import { ToolRoomView } from './views/mobile/ToolRoomView';
import { ExpensesView } from './views/mobile/ExpensesView';
import { ReportsView } from './views/mobile/ReportsView';
import { Toast, type ToastMessage } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { AppShell } from './components/AppShell';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { SiteDetailView } from './views/SiteDetailView';
import { TrashView } from './views/TrashView';
import { BackupView } from './views/BackupView';
import { EstimatorView } from './views/EstimatorView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { FloorPlanListView } from './views/FloorPlanListView';
import { FloorPlanEditorView } from './views/FloorPlanEditorView';
import { ChangeInitialPasswordModal } from './components/ChangeInitialPasswordModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { checkPasswordRecoveryUrl, isSupabaseConfigured, supabase } from './services/supabase';
import { runCloudSync } from './services/cloudSync';

import { SiteModal } from './components/SiteModal';
import { MaterialModal } from './components/MaterialModal';
import { RodModal } from './components/RodModal';
import { WorkerModal } from './components/WorkerModal';
import { AttendanceModal } from './components/AttendanceModal';
import { AdvanceModal } from './components/AdvanceModal';
import { SalaryPaymentModal } from './components/SalaryPaymentModal';
import { ToolModal } from './components/ToolModal';
import { TeaSnacksModal } from './components/TeaSnacksModal';
import { PoojaModal } from './components/PoojaModal';
import { ElectricityModal } from './components/ElectricityModal';
import { WaterModal } from './components/WaterModal';
import { OtherExpenseModal } from './components/OtherExpenseModal';
import { CommentModal } from './components/CommentModal';

import { useSiteData } from './hooks/useSiteData';
import { getCurrentUser, logoutUser, initAuth, isAdmin } from './services/auth';

import type {
  Site,
  Material,
  RodEntry,
  LabourWorker,
  LabourAdvance,
  SalaryPayment,
  ToolItem,
  TeaSnacksExpense,
  PoojaExpense,
  ElectricityBill,
  WaterBill,
  OtherExpense,
  SiteComment,
  MaterialCategory,
  TrashRecord,
  EntityTable,
  User,
} from './db/types';

type AppViewName =
  | 'dashboard' | 'my-sites' | 'site-detail' | 'trash' | 'backup' | 'estimator' | 'admin'
  | 'floor-plans' | 'floor-plan-editor'
  | 'labour' | 'worker' | 'stock' | 'toolroom' | 'expenses' | 'reports';

const PROJECT_VIEWS: AppViewName[] = ['labour', 'worker', 'stock', 'toolroom', 'expenses', 'reports'];
const CURRENT_SITE_KEY = 'mistry_current_site';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppViewName>('dashboard');
  // The current project is remembered on this device so the app reopens where the user left off.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(() => {
    try { return localStorage.getItem(CURRENT_SITE_KEY); } catch { return null; }
  });
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null);
  // A floor area handed from the Floor Planner to the Building Calculator.
  const [estimatorAreaSqFt, setEstimatorAreaSqFt] = useState<number | null>(null);
  const [currentSiteTab, setCurrentSiteTab] = useState<
    'overview' | 'materials' | 'labour' | 'tools' | 'expenses' | 'payments' | 'comments' | 'reports' | 'variance'
  >('overview');
  const [currentExpenseSubSection, setCurrentExpenseSubSection] = useState<'tea' | 'pooja' | 'electricity' | 'water' | 'other'>('tea');
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [pendingSiteTab, setPendingSiteTab] = useState<{ tab: string; subTab?: string } | null>(null);

  // Online / Offline Status
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showOnlineRestored, setShowOnlineRestored] = useState(false);

  // PWA Install Prompt Event
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  });

  // Query all active sites for the user (used by fast site switcher/picker)
  const userSitesQuery = useLiveQuery(async () => {
    if (!currentUser) return [];
    return await db.getSitesForUser(currentUser);
  }, [currentUser]);
  const userSites = userSitesQuery || [];

  // Keep the remembered project valid: drop it if it was deleted or belongs to another
  // account, and pick the only project automatically when there is just one.
  useEffect(() => {
    if (!userSitesQuery) return;
    const stillThere = selectedSiteId && userSitesQuery.some(s => s.id === selectedSiteId);
    if (!stillThere) {
      const next = userSitesQuery.length === 1 ? userSitesQuery[0].id : null;
      if (next !== selectedSiteId) setSelectedSiteId(next);
    }
  }, [userSitesQuery, selectedSiteId]);

  useEffect(() => {
    try {
      if (selectedSiteId) localStorage.setItem(CURRENT_SITE_KEY, selectedSiteId);
      else localStorage.removeItem(CURRENT_SITE_KEY);
    } catch { /* storage unavailable */ }
  }, [selectedSiteId]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(() => checkPasswordRecoveryUrl());

  // Initialize Auth, Network status & PWA install listeners
  useEffect(() => {
    initAuth().then(() => {
      const u = getCurrentUser();
      if (u) {
        setCurrentUser(u);
        if (u.offlineLimited) {
          addToast('Cloud profile unavailable. Using local records only; elevated access is disabled until reconnected.', 'info');
        }
      }
    }).catch(error => {
      setCurrentUser(null);
      addToast(error instanceof Error ? error.message : 'Could not verify your secure account.', 'error');
    });

    if (checkPasswordRecoveryUrl()) {
      setIsRecoveryModalOpen(true);
    }

    let authSub: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryModalOpen(true);
        }
        if (event === 'SIGNED_OUT') setCurrentUser(null);
      });
      authSub = data?.subscription || null;
    }

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineRestored(true);
      setTimeout(() => setShowOnlineRestored(false), 4000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setInstallPromptEvent(null);
      addToast('Building Mistry installed successfully!', 'success');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (authSub) authSub.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setIsPwaInstalled(true);
      addToast('Installing Building Mistry app...', 'info');
    }
    setInstallPromptEvent(null);
  };

  // Site Modal State
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);

  // Material Modal State
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [matCategory, setMatCategory] = useState<MaterialCategory>('sand');
  const [matToEdit, setMatToEdit] = useState<Material | null>(null);

  // Rod Modal State
  const [rodModalOpen, setRodModalOpen] = useState(false);
  const [rodToEdit, setRodToEdit] = useState<RodEntry | null>(null);

  // Worker Modal State
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<LabourWorker | null>(null);

  // Attendance Modal State
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  // Advance Modal State
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceToEdit, setAdvanceToEdit] = useState<LabourAdvance | null>(null);

  // Salary Payment Modal State
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [salaryToEdit, setSalaryToEdit] = useState<SalaryPayment | null>(null);

  // Tool Modal State
  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [toolToEdit, setToolToEdit] = useState<ToolItem | null>(null);

  // Tea Snacks Modal State
  const [teaModalOpen, setTeaModalOpen] = useState(false);
  const [teaToEdit, setTeaToEdit] = useState<TeaSnacksExpense | null>(null);

  // Pooja Modal State
  const [poojaModalOpen, setPoojaModalOpen] = useState(false);
  const [poojaToEdit, setPoojaToEdit] = useState<PoojaExpense | null>(null);

  // Electricity Modal State
  const [electricityModalOpen, setElectricityModalOpen] = useState(false);
  const [electricityToEdit, setElectricityToEdit] = useState<ElectricityBill | null>(null);

  // Water Modal State
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [waterToEdit, setWaterToEdit] = useState<WaterBill | null>(null);

  // Other Expense Modal State
  const [otherModalOpen, setOtherModalOpen] = useState(false);
  const [otherToEdit, setOtherToEdit] = useState<OtherExpense | null>(null);

  // Comment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentToEdit, setCommentToEdit] = useState<SiteComment | null>(null);

  // Confirmation Modal State (Safe-Delete to Trash, Permanent Delete, Restore)
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDanger?: boolean;
    type?: 'trash' | 'permanent-delete' | 'restore' | 'general';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Current Site live data hook for modals that require worker/attendance info
  const siteData = useSiteData(selectedSiteId);

  // Notification Toast Helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Cloud backup: when the user has signed in to it, sync quietly on start, when the
  // connection returns, and every few minutes while the app is open. Records always save to
  // this device first, so a failed or skipped sync never loses anything.
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured() || !supabase) return;
    const client = supabase;
    const user = currentUser;
    const syncQuietly = () => {
      if (navigator.onLine === false || document.visibilityState === 'hidden') return;
      void runCloudSync(client, user);
    };
    syncQuietly();
    window.addEventListener('online', syncQuietly);
    const timer = window.setInterval(syncQuietly, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('online', syncQuietly);
      window.clearInterval(timer);
    };
  }, [currentUser]);

  const handleLogout = () => {
    // The next person to use this device must not sync into this person's cloud account.
    if (supabase) void supabase.auth.signOut();
    logoutUser();
    setCurrentUser(null);
    addToast('Signed out of Building Mistry', 'info');
  };

  // Navigation Helper with deep tab and sub-tab support
  const handleNavigate = (view: string, siteId?: string, tab?: string, subTab?: string) => {
    if (view === 'site-detail' && siteId) {
      setSelectedSiteId(siteId);
      if (tab) setCurrentSiteTab(tab as any);
      if (subTab) setCurrentExpenseSubSection(subTab as any);
      setCurrentView('site-detail');
    } else if (view === 'trash') {
      setCurrentView('trash');
    } else if (view === 'backup') {
      setCurrentView('backup');
    } else if (view === 'my-sites') {
      setCurrentView('my-sites');
    } else if (view === 'estimator') {
      setEstimatorAreaSqFt(null);
      setCurrentView('estimator');
    } else if (view === 'admin') {
      if (isAdmin(currentUser)) {
        setCurrentView('admin');
      } else {
        addToast('Access denied: Admin Portal is restricted to administrators', 'error');
      }
    } else if (view === 'floor-plans') {
      setCurrentView('floor-plans');
    } else if (view === 'floor-plan-editor') {
      setCurrentView('floor-plan-editor');
    } else if (PROJECT_VIEWS.includes(view as AppViewName)) {
      if (siteId) setSelectedSiteId(siteId);
      if (!siteId && !selectedSiteId) {
        addToast(userSites.length ? 'Choose a project first' : 'Create your first project', 'info');
        setCurrentView('dashboard');
      } else {
        setCurrentView(view as AppViewName);
      }
    } else {
      setCurrentView('dashboard');
    }
    window.scrollTo(0, 0);
  };

  const handleSelectSite = (id: string) => {
    setSelectedSiteId(id);
    setSelectedWorkerId(null);
    if (currentView === 'my-sites' || currentView === 'site-detail' || currentView === 'worker') setCurrentView('dashboard');
  };

  const openNewSiteModal = () => {
    setSiteToEdit(null);
    setSiteModalOpen(true);
  };

  // Direct Site Section opener from mobile bottom navigation
  const handleOpenSiteTab = (tab: string, subTab?: string) => {
    if (selectedSiteId) {
      setCurrentSiteTab(tab as any);
      if (subTab) setCurrentExpenseSubSection(subTab as any);
      setCurrentView('site-detail');
    } else {
      // If user has exactly 1 site, automatically pick that site
      if (userSites.length === 1) {
        setSelectedSiteId(userSites[0].id);
        setCurrentSiteTab(tab as any);
        if (subTab) setCurrentExpenseSubSection(subTab as any);
        setCurrentView('site-detail');
      } else if (userSites.length > 1) {
        // Multiple sites: show fast mobile Site Picker sheet
        setPendingSiteTab({ tab, subTab });
        setIsSitePickerOpen(true);
      } else {
        addToast('Please create your first construction site', 'info');
        setSiteModalOpen(true);
      }
    }
  };

  // Safe-Delete to Trash Helper
  const handleSoftDelete = (tableName: EntityTable, id: string, displayName: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Move Record to Recycle Bin',
      message: `Are you sure you want to delete "${displayName}"? It will not be lost and can be recovered from the Recycle Bin at any time.`,
      confirmLabel: 'Move to Trash',
      isDanger: false,
      type: 'trash',
      onConfirm: async () => {
        try {
          if (!currentUser) throw new Error('Sign in is required to modify records.');
          await db.softDelete(tableName, id, currentUser);
          addToast(`"${displayName}" moved to Recycle Bin`, 'info');
          if (tableName === 'sites' && selectedSiteId === id) {
            handleNavigate('dashboard');
          }
        } catch (err: any) {
          addToast('Failed to move to trash: ' + err.message, 'error');
        } finally {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Restore Record from Trash Helper
  const handleRestore = (item: TrashRecord) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Restore Record',
      message: `Restore "${item.title}" back to active records? It will immediately reappear in its construction site ledger.`,
      confirmLabel: 'Restore Record',
      isDanger: false,
      type: 'restore',
      onConfirm: async () => {
        try {
          if (!currentUser) throw new Error('Sign in is required to modify records.');
          await db.restoreRecord(item.tableName, item.id, currentUser);
          addToast(`"${item.title}" successfully restored!`, 'success');
        } catch (err: any) {
          addToast('Failed to restore: ' + err.message, 'error');
        } finally {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Permanent Delete Confirmation Helper
  const handlePermanentDelete = (item: TrashRecord) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Delete Permanently?',
      message: `Are you completely sure you want to permanently destroy "${item.title}"? THIS CANNOT BE UNDONE!`,
      confirmLabel: 'Permanently Erase',
      isDanger: true,
      type: 'permanent-delete',
      onConfirm: async () => {
        try {
          if (!currentUser) throw new Error('Sign in is required to modify records.');
          await db.permanentDelete(currentUser, item.tableName, item.id);
          addToast(`"${item.title}" permanently erased from database.`, 'info');
        } catch (err: any) {
          addToast('Failed to permanently delete: ' + err.message, 'error');
        } finally {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Empty Trash Confirmation Helper
  const handleEmptyTrash = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Empty Recycle Bin?',
      message: 'Are you sure you want to permanently delete ALL items currently in the Recycle Bin? All deleted records will be permanently erased and cannot be recovered.',
      confirmLabel: 'Permanently Erase All',
      isDanger: true,
      type: 'permanent-delete',
      onConfirm: async () => {
        try {
          if (!currentUser) throw new Error('Sign in is required to modify records.');
          const trash = await db.getAllTrash(currentUser, 'write');
          for (const item of trash) {
            await db.permanentDelete(currentUser, item.tableName, item.id);
          }
          addToast(`Emptied Recycle Bin (${trash.length} records erased).`, 'info');
        } catch (err: any) {
          addToast('Failed to empty trash: ' + err.message, 'error');
        } finally {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // If user is not authenticated, show Login Screen
  if (!currentUser) {
    return (
      <>
        <LoginView
          onLoginSuccess={user => {
            setCurrentUser(user);
            addToast(`Welcome, ${user.fullName}!`, 'success');
          }}
        />
        <Toast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  const chromeProps = {
    user: currentUser,
    currentView,
    sites: userSites,
    siteId: selectedSiteId,
    onSelectSite: handleSelectSite,
    onNavigate: (view: string) => handleNavigate(view),
    onOpenClassic: () => selectedSiteId && handleNavigate('site-detail', selectedSiteId, 'overview'),
    onNewSite: openNewSiteModal,
    onLogout: handleLogout,
    canInstall: !!installPromptEvent && !isPwaInstalled,
    onInstall: handleInstallPwa,
  };

  return (
    <div className={`app-container ${currentView === 'floor-plan-editor' ? 'm-immersive' : ''}`}>
      <MobileTopBar {...chromeProps} />

      <AppShell
        user={currentUser}
        currentView={currentView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onOpenNewSiteModal={() => { setSiteToEdit(null); setSiteModalOpen(true); }}
        onOpenSiteTab={handleOpenSiteTab}
        isOnline={isOnline}
        showOnlineRestored={showOnlineRestored}
        installPromptEvent={installPromptEvent}
        onInstallPwa={handleInstallPwa}
        isPwaInstalled={isPwaInstalled}
      >
        {/* Main View Router */}
        <main>
        {currentView === 'dashboard' && (
          <HomeView
            user={currentUser}
            sites={userSites}
            siteId={selectedSiteId}
            onSelectSite={handleSelectSite}
            onGo={view => handleNavigate(view)}
            onOpenClassic={id => handleNavigate('site-detail', id, 'overview')}
            onNewSite={openNewSiteModal}
            onNotify={addToast}
          />
        )}

        {currentView === 'my-sites' && (
          <DashboardView
            onlySites={true}
            onOpenSite={handleSelectSite}
            onOpenNewSiteModal={() => {
              setSiteToEdit(null);
              setSiteModalOpen(true);
            }}
            onEditSite={site => {
              setSiteToEdit(site);
              setSiteModalOpen(true);
            }}
            onDeleteSiteToTrash={site => handleSoftDelete('sites', site.id, site.name)}
            onNotify={addToast}
            user={currentUser}
          />
        )}

        {currentView === 'site-detail' && selectedSiteId && (
          <SiteDetailView
            siteId={selectedSiteId}
            initialTab={currentSiteTab}
            initialExpenseSubSection={currentExpenseSubSection}
            onTabChange={(tab, sub) => {
              setCurrentSiteTab(tab as any);
              if (sub) setCurrentExpenseSubSection(sub as any);
            }}
            onBack={() => handleNavigate('dashboard')}
            onEditSite={site => {
              setSiteToEdit(site);
              setSiteModalOpen(true);
            }}
            onDeleteSite={site => handleSoftDelete('sites', site.id, site.name)}
            onOpenMaterialModal={(category, material) => {
              setMatCategory(category);
              setMatToEdit(material || null);
              setMatModalOpen(true);
            }}
            onOpenRodModal={rod => {
              setRodToEdit(rod || null);
              setRodModalOpen(true);
            }}
            onOpenWorkerModal={worker => {
              setWorkerToEdit(worker || null);
              setWorkerModalOpen(true);
            }}
            onOpenAttendanceModal={() => setAttendanceModalOpen(true)}
            onOpenAdvanceModal={adv => {
              setAdvanceToEdit(adv || null);
              setAdvanceModalOpen(true);
            }}
            onOpenSalaryModal={sal => {
              setSalaryToEdit(sal || null);
              setSalaryModalOpen(true);
            }}
            onOpenToolModal={tool => {
              setToolToEdit(tool || null);
              setToolModalOpen(true);
            }}
            onOpenTeaModal={tea => {
              setTeaToEdit(tea || null);
              setTeaModalOpen(true);
            }}
            onOpenPoojaModal={pooja => {
              setPoojaToEdit(pooja || null);
              setPoojaModalOpen(true);
            }}
            onOpenElectricityModal={elec => {
              setElectricityToEdit(elec || null);
              setElectricityModalOpen(true);
            }}
            onOpenWaterModal={water => {
              setWaterToEdit(water || null);
              setWaterModalOpen(true);
            }}
            onOpenOtherModal={expense => {
              setOtherToEdit(expense || null);
              setOtherModalOpen(true);
            }}
            onOpenCommentModal={comment => {
              setCommentToEdit(comment || null);
              setCommentModalOpen(true);
            }}
            onTrashRecord={(table, id, name) => handleSoftDelete(table, id, name)}
            onOpenEstimator={() => handleNavigate('estimator')}
            onOpenFloorPlans={siteId => {
              setSelectedSiteId(siteId);
              setCurrentView('floor-plans');
            }}
            onNotify={addToast}
            onReturnToAdmin={isAdmin(currentUser) ? () => handleNavigate('admin') : undefined}
          />
        )}

        {currentView === 'labour' && selectedSiteId && (
          <LabourView
            user={currentUser}
            siteId={selectedSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenWorker={id => {
              setSelectedWorkerId(id);
              setCurrentView('worker');
              window.scrollTo(0, 0);
            }}
            onAddWorker={() => {
              setWorkerToEdit(null);
              setWorkerModalOpen(true);
            }}
            onNotify={addToast}
          />
        )}

        {currentView === 'worker' && selectedSiteId && selectedWorkerId && (
          <WorkerProfileView
            user={currentUser}
            siteId={selectedSiteId}
            workerId={selectedWorkerId}
            onBack={() => {
              setCurrentView('labour');
              window.scrollTo(0, 0);
            }}
            onEditWorker={worker => {
              setWorkerToEdit(worker);
              setWorkerModalOpen(true);
            }}
            onNotify={addToast}
          />
        )}

        {currentView === 'stock' && selectedSiteId && (
          <StockView
            user={currentUser}
            siteId={selectedSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenSteelPurchase={() => {
              setRodToEdit(null);
              setRodModalOpen(true);
            }}
            onOpenLedger={() => handleNavigate('site-detail', selectedSiteId, 'materials')}
            onNotify={addToast}
          />
        )}

        {currentView === 'toolroom' && selectedSiteId && (
          <ToolRoomView
            user={currentUser}
            siteId={selectedSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenLedger={() => handleNavigate('site-detail', selectedSiteId, 'tools')}
            onNotify={addToast}
          />
        )}

        {currentView === 'expenses' && selectedSiteId && (
          <ExpensesView
            user={currentUser}
            siteId={selectedSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenLedger={() => handleNavigate('site-detail', selectedSiteId, 'expenses')}
            onNotify={addToast}
          />
        )}

        {currentView === 'reports' && selectedSiteId && (
          <ReportsView siteId={selectedSiteId} onBack={() => handleNavigate('dashboard')} onNotify={addToast} />
        )}

        {currentView === 'floor-plans' && currentUser && (
          <FloorPlanListView
            user={currentUser}
            onOpenEditor={(planId, siteId) => {
              setSelectedFloorPlanId(planId);
              setCurrentView('floor-plan-editor');
            }}
            onNotify={addToast}
            initialSiteId={selectedSiteId}
            onOpenNewSiteModal={() => {
              setSiteToEdit(null);
              setSiteModalOpen(true);
            }}
          />
        )}

        {currentView === 'floor-plan-editor' && currentUser && (
          selectedFloorPlanId ? (
            <FloorPlanEditorView
              planId={selectedFloorPlanId}
              user={currentUser}
              onBack={() => setCurrentView('floor-plans')}
              onBackToSite={(siteId) => {
                setSelectedSiteId(siteId);
                setCurrentView('site-detail');
              }}
              onNotify={addToast}
              onOpenEstimator={(areaSqFt) => {
                handleNavigate('estimator');
                setEstimatorAreaSqFt(areaSqFt);
                addToast(`Floor plan area ${areaSqFt.toFixed(0)} sq.ft is set as the building size on one floor`, 'info');
              }}
            />
          ) : (
            <FloorPlanListView
              user={currentUser}
              onOpenEditor={(planId) => {
                setSelectedFloorPlanId(planId);
                setCurrentView('floor-plan-editor');
              }}
              onNotify={addToast}
              onOpenNewSiteModal={() => {
                setSiteToEdit(null);
                setSiteModalOpen(true);
              }}
            />
          )
        )}


        {currentView === 'estimator' && (
          <EstimatorView
            user={currentUser}
            initialBuildingSqFt={estimatorAreaSqFt}
            onBack={() => handleNavigate('dashboard')}
            onOpenSite={siteId => handleNavigate('site-detail', siteId)}
            onNotify={addToast}
          />
        )}

        {currentView === 'admin' && isAdmin(currentUser) && (
          <AdminDashboardView
            currentUser={currentUser}
            onShowToast={addToast}
          />
        )}

        {currentView === 'trash' && (
          <TrashView
            onBack={() => handleNavigate('dashboard')}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            onEmptyTrash={handleEmptyTrash}
            user={currentUser}
          />
        )}

        {currentView === 'backup' && (
          <BackupView
            user={currentUser}
            onBack={() => handleNavigate('dashboard')}
            onNotify={addToast}
          />
        )}
      </main>
      </AppShell>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav {...chromeProps} />

      {/* Fast Mobile Site Selector Sheet */}
      {isSitePickerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsSitePickerOpen(false)}>
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Select Project Site"
          >
            <div className="mobile-drawer-handle-bar">
              <div className="mobile-drawer-drag-pill" />
            </div>
            <div className="mobile-drawer-header">
              <div>
                <h3 className="mobile-drawer-title">Choose Project Site</h3>
                <p className="mobile-drawer-sub">Select a site to view {pendingSiteTab?.tab || 'ledger'}</p>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setIsSitePickerOpen(false)}
                aria-label="Close site picker"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {userSites.map(site => (
                <button
                  key={site.id}
                  type="button"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-100 text-left transition-all active:scale-98"
                  onClick={() => {
                    setSelectedSiteId(site.id);
                    if (pendingSiteTab?.tab) setCurrentSiteTab(pendingSiteTab.tab as any);
                    if (pendingSiteTab?.subTab) setCurrentExpenseSubSection(pendingSiteTab.subTab as any);
                    setIsSitePickerOpen(false);
                    setPendingSiteTab(null);
                    setCurrentView('site-detail');
                  }}
                >
                  <div>
                    <div className="font-bold text-sm text-slate-100">{site.name}</div>
                    <div className="text-xs text-slate-400">
                      {site.ownerName} • {site.area || site.buildingType}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-amber-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmLabel={confirmModalState.confirmLabel}
        isDanger={confirmModalState.isDanger}
        type={confirmModalState.type}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Floating Toasts */}
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Site Creation / Edit Modal */}
      <SiteModal
        isOpen={siteModalOpen}
        siteToEdit={siteToEdit}
        onClose={() => {
          setSiteModalOpen(false);
          setSiteToEdit(null);
        }}
        onSuccess={(msg, newSiteId) => {
          addToast(msg, 'success');
          // After saving, keep user on current list view so new site is immediately visible in the site list
          if (currentView === 'site-detail' && siteToEdit) {
            handleNavigate('site-detail', newSiteId);
          } else if (currentView === 'site-detail') {
            handleNavigate('dashboard');
          }
        }}
      />

      {/* Material Modal */}
      {selectedSiteId && (
        <MaterialModal
          isOpen={matModalOpen}
          siteId={selectedSiteId}
          category={matCategory}
          materialToEdit={matToEdit}
          onClose={() => {
            setMatModalOpen(false);
            setMatToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Rod / Steel Modal */}
      {selectedSiteId && (
        <RodModal
          isOpen={rodModalOpen}
          siteId={selectedSiteId}
          rodToEdit={rodToEdit}
          onClose={() => {
            setRodModalOpen(false);
            setRodToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Worker Modal */}
      {selectedSiteId && (
        <WorkerModal
          isOpen={workerModalOpen}
          siteId={selectedSiteId}
          workerToEdit={workerToEdit}
          onClose={() => {
            setWorkerModalOpen(false);
            setWorkerToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Daily Attendance Modal */}
      {selectedSiteId && siteData && (
        <AttendanceModal
          isOpen={attendanceModalOpen}
          siteId={selectedSiteId}
          workers={siteData.workers}
          onClose={() => setAttendanceModalOpen(false)}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Labour Advance Modal */}
      {selectedSiteId && siteData && (
        <AdvanceModal
          isOpen={advanceModalOpen}
          siteId={selectedSiteId}
          workers={siteData.workers}
          advanceToEdit={advanceToEdit}
          onClose={() => {
            setAdvanceModalOpen(false);
            setAdvanceToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Salary Payment Modal */}
      {selectedSiteId && siteData && (
        <SalaryPaymentModal
          isOpen={salaryModalOpen}
          siteId={selectedSiteId}
          workers={siteData.workers}
          attendance={siteData.attendance}
          advances={siteData.advances}
          pastPayments={siteData.salaryPayments}
          paymentToEdit={salaryToEdit}
          onClose={() => {
            setSalaryModalOpen(false);
            setSalaryToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Tool Modal */}
      {selectedSiteId && (
        <ToolModal
          isOpen={toolModalOpen}
          siteId={selectedSiteId}
          toolToEdit={toolToEdit}
          onClose={() => {
            setToolModalOpen(false);
            setToolToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Tea & Snacks Modal */}
      {selectedSiteId && (
        <TeaSnacksModal
          isOpen={teaModalOpen}
          siteId={selectedSiteId}
          expenseToEdit={teaToEdit}
          onClose={() => {
            setTeaModalOpen(false);
            setTeaToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Pooja Modal */}
      {selectedSiteId && (
        <PoojaModal
          isOpen={poojaModalOpen}
          siteId={selectedSiteId}
          poojaToEdit={poojaToEdit}
          onClose={() => {
            setPoojaModalOpen(false);
            setPoojaToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Electricity Modal */}
      {selectedSiteId && (
        <ElectricityModal
          isOpen={electricityModalOpen}
          siteId={selectedSiteId}
          billToEdit={electricityToEdit}
          onClose={() => {
            setElectricityModalOpen(false);
            setElectricityToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Water Modal */}
      {selectedSiteId && (
        <WaterModal
          isOpen={waterModalOpen}
          siteId={selectedSiteId}
          billToEdit={waterToEdit}
          onClose={() => {
            setWaterModalOpen(false);
            setWaterToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Other Expense Modal */}
      {selectedSiteId && (
        <OtherExpenseModal
          isOpen={otherModalOpen}
          siteId={selectedSiteId}
          expenseToEdit={otherToEdit}
          onClose={() => {
            setOtherModalOpen(false);
            setOtherToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Site Comment Modal */}
      {selectedSiteId && (
        <CommentModal
          isOpen={commentModalOpen}
          siteId={selectedSiteId}
          commentToEdit={commentToEdit}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentToEdit(null);
          }}
          onSuccess={msg => addToast(msg, 'success')}
        />
      )}

      {/* Mandatory Password Change Modal for Session Users */}
      {currentUser && currentUser.mustChangePassword && (
        <ChangeInitialPasswordModal
          isOpen={true}
          user={currentUser}
          onSuccess={() => {
            const updated = { ...currentUser, mustChangePassword: false };
            setCurrentUser(updated);
            addToast('Password successfully updated. Your account is secured.', 'success');
          }}
        />
      )}

      {/* Supabase Password Recovery Flow Modal */}
      <ResetPasswordModal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        onSuccess={msg => addToast(msg, 'success')}
      />
    </div>
  );
}

export default App;
