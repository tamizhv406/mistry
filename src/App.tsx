import React, { lazy, Suspense, useState, useEffect, useReducer } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, X, Download, Building2 } from 'lucide-react';
import { db } from './db/db';
import { MobileBottomNav, ProjectSwitcher } from './components/mobile/MobileChrome';
import type { AppView as HomeTarget, QuickAction } from './views/mobile/HomeView';
import { pickStartProject, readLastProject, rememberLastProject } from './domain/dashboard';
import { useIsPhone } from './hooks/useIsPhone';
import { Toast, type ToastMessage } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { AppShell } from './components/AppShell';

import { LoginView, type AuthNotice } from './views/LoginView';
import { SplashScreen } from './components/auth/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChangeInitialPasswordModal } from './components/ChangeInitialPasswordModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { checkPasswordRecoveryUrl, isSupabaseConfigured, supabase } from './services/supabase';
import { runCloudSync } from './services/cloudSync';

// Code-split every primary and secondary screen so initial load stays small & fast.
const HomeView = lazy(() => import('./views/mobile/HomeView').then(m => ({ default: m.HomeView })));
const LabourView = lazy(() => import('./views/mobile/LabourView').then(m => ({ default: m.LabourView })));
const WorkerProfileView = lazy(() => import('./views/mobile/WorkerProfileView').then(m => ({ default: m.WorkerProfileView })));
const StockView = lazy(() => import('./views/mobile/StockView').then(m => ({ default: m.StockView })));
const ToolRoomView = lazy(() => import('./views/mobile/ToolRoomView').then(m => ({ default: m.ToolRoomView })));
const ExpensesView = lazy(() => import('./views/mobile/ExpensesView').then(m => ({ default: m.ExpensesView })));
const ReportsView = lazy(() => import('./views/mobile/ReportsView').then(m => ({ default: m.ReportsView })));
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const ProjectsView = lazy(() => import('./views/ProjectsView').then(m => ({ default: m.ProjectsView })));
const SiteDetailView = lazy(() => import('./views/SiteDetailView').then(m => ({ default: m.SiteDetailView })));
const TrashView = lazy(() => import('./views/TrashView').then(m => ({ default: m.TrashView })));
const BackupView = lazy(() => import('./views/BackupView').then(m => ({ default: m.BackupView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const EstimatorView = lazy(() => import('./views/EstimatorView').then(m => ({ default: m.EstimatorView })));
const AdminDashboardView = lazy(() => import('./views/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const FloorPlanListView = lazy(() => import('./views/FloorPlanListView').then(m => ({ default: m.FloorPlanListView })));
const FloorPlannerHostView = lazy(() => import('./views/FloorPlannerHostView').then(m => ({ default: m.FloorPlannerHostView })));
const MaterialsView = lazy(() => import('./views/MaterialsView').then(m => ({ default: m.MaterialsView })));
const AttendanceSalaryView = lazy(() => import('./views/AttendanceSalaryView').then(m => ({ default: m.AttendanceSalaryView })));

const ViewLoadingFallback: React.FC = () => (
  <div
    role="status"
    aria-label="Loading screen"
    style={{
      minHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 24,
      backgroundColor: 'var(--color-bg, #FAFAF9)',
      color: 'var(--color-charcoal, #1F2937)',
      fontSize: 15,
      fontWeight: 600,
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '3px solid var(--color-border, #E7E5E4)',
        borderTopColor: 'var(--color-primary, #F97316)',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <span>Loading…</span>
  </div>
);

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
import { logoutUser, initAuth, isAdmin, LOCAL_BUILDER_ID } from './services/auth';
import { InactiveAccountError } from './services/cloudAuth';
import { authGateReducer, initialAuthGateState } from './services/authFlow';
import { performFullSync } from './services/cloudSyncService';

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
import { APP_NAME } from './config/brand';

type AppViewName =
  | 'dashboard' | 'my-sites' | 'site-detail' | 'trash' | 'backup' | 'settings' | 'estimator' | 'admin'
  | 'floor-plans' | 'floor-plan-editor'
  | 'labour' | 'worker' | 'stock' | 'toolroom' | 'expenses' | 'reports';

const PROJECT_VIEWS: AppViewName[] = ['labour', 'worker', 'stock', 'toolroom', 'expenses', 'reports'];

interface WorkspaceProps {
  /** The signed-in account (the workspace never opens without one). */
  user: User;
  /** Signed in during this visit: offer to move projects made on this device without an account. */
  justSignedIn: boolean;
  /** Opened from a password-reset email link. */
  recoveryRequested: boolean;
  onRecoveryHandled: () => void;
  onSignOut: () => Promise<void>;
}

/** The app itself: projects, labour, stock and the rest. Rendered by App only for a signed-in account. */
function Workspace({ user, justSignedIn, recoveryRequested, onRecoveryHandled, onSignOut }: WorkspaceProps) {
  // App remounts the workspace (key = account id) when the account changes.
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [localSitesToMerge, setLocalSitesToMerge] = useState<Site[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetUser, setMergeTargetUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppViewName>('dashboard');
  const isPhone = useIsPhone();
  // The current project is remembered on this device so the app reopens on it, straight to its
  // dashboard (no project list first).
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(() => readLastProject(typeof localStorage === 'undefined' ? null : localStorage));
  // A form a home-screen quick action asked the next screen to open with.
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  // A floor area handed from the Floor Planner to the Building Calculator.
  const [estimatorAreaSqFt, setEstimatorAreaSqFt] = useState<number | null>(null);
  // The floor plan open in the Floor Planner.
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string | null>(null);
  // Set when the plan list is opened from a site, so it shows that site's plans first.
  const [floorPlanSiteId, setFloorPlanSiteId] = useState<string | null>(null);
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

  // Keep the open project valid: the last viewed one while it exists for this account,
  // otherwise the first active project; none only when there are no projects.
  useEffect(() => {
    if (!userSitesQuery) return;
    const next = pickStartProject(userSitesQuery, selectedSiteId);
    if (next !== selectedSiteId) setSelectedSiteId(next);
  }, [userSitesQuery, selectedSiteId]);

  useEffect(() => {
    rememberLastProject(typeof localStorage === 'undefined' ? null : localStorage, selectedSiteId);
  }, [selectedSiteId]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(recoveryRequested);
  // A reset link can also arrive after the workspace opened (Supabase PASSWORD_RECOVERY event).
  const [seenRecoveryRequest, setSeenRecoveryRequest] = useState(recoveryRequested);
  if (recoveryRequested !== seenRecoveryRequest) {
    setSeenRecoveryRequest(recoveryRequested);
    if (recoveryRequested) setIsRecoveryModalOpen(true);
  }

  // Network status & PWA install listeners (sign-in is handled by App before this screen opens)
  useEffect(() => {

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
      addToast(`${APP_NAME} installed successfully!`, 'success');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
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
      addToast(`Installing ${APP_NAME} app...`, 'info');
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

  const [signingOut, setSigningOut] = useState(false);
  const signOutNow = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // The next person to use this device must not sync into this person's cloud account.
    await onSignOut();
  };
  const handleLogout = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Offline, signing out locks the device until it is online again: ask first.
      setConfirmModalState({
        isOpen: true,
        title: 'Sign out while offline?',
        message: 'You are offline. After signing out you cannot log back in until you are online. Your records stay saved on this device.',
        confirmLabel: 'Sign out',
        isDanger: true,
        type: 'general',
        onConfirm: () => {
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
          void signOutNow();
        },
      });
      return;
    }
    void signOutNow();
  };

  // Opened with limited rights (offline, or the cloud profile could not be loaded).
  useEffect(() => {
    if (user.offlineLimited) {
      addToast('Cloud profile unavailable. Using records saved on this device; admin access returns when you reconnect.', 'info');
    }
    // Projects made on this device before sign-in was required: offer to move them into the account.
    if (justSignedIn) {
      db.sites
        .filter(s => s.userId === LOCAL_BUILDER_ID || s.userId === 'local-builder-user')
        .toArray()
        .then(localSites => {
          if (localSites.length > 0) {
            setLocalSitesToMerge(localSites);
            setMergeTargetUser(user);
            setIsMergeModalOpen(true);
          }
        })
        .catch(err => console.error('Failed checking local sites for merge:', err));
    }
    // Once, when the workspace opens for this account (App remounts it for another account).
  }, [user, justSignedIn]);

  // ── Custom Mobile Back Navigation & History Stack (Requirement 3) ──
  const currentViewRef = React.useRef(currentView);
  React.useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const viewHistoryRef = React.useRef<Array<{ view: AppViewName; siteId?: string | null; tab?: string; subTab?: string }>>([]);

  const isAnyModalOpen =
    isRecoveryModalOpen ||
    isSitePickerOpen ||
    siteModalOpen ||
    matModalOpen ||
    rodModalOpen ||
    workerModalOpen ||
    attendanceModalOpen ||
    advanceModalOpen ||
    salaryModalOpen ||
    toolModalOpen ||
    teaModalOpen ||
    poojaModalOpen ||
    electricityModalOpen ||
    waterModalOpen ||
    otherModalOpen ||
    commentModalOpen ||
    confirmModalState.isOpen;

  const modalOpenRef = React.useRef(isAnyModalOpen);
  React.useEffect(() => {
    modalOpenRef.current = isAnyModalOpen;
    if (isAnyModalOpen && typeof window !== 'undefined' && window.history) {
      window.history.pushState({ appState: 'modal' }, '');
    }
  }, [isAnyModalOpen]);

  const closeAllModals = React.useCallback(() => {
    setIsRecoveryModalOpen(false);
    setIsSitePickerOpen(false);
    setSiteModalOpen(false);
    setMatModalOpen(false);
    setRodModalOpen(false);
    setWorkerModalOpen(false);
    setAttendanceModalOpen(false);
    setAdvanceModalOpen(false);
    setSalaryModalOpen(false);
    setToolModalOpen(false);
    setTeaModalOpen(false);
    setPoojaModalOpen(false);
    setElectricityModalOpen(false);
    setWaterModalOpen(false);
    setOtherModalOpen(false);
    setCommentModalOpen(false);
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const lastBackPressRef = React.useRef(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history.state) {
      window.history.replaceState({ appState: 'root', view: 'dashboard' }, '');
    }

    const handlePopState = (_e: PopStateEvent) => {
      // 0. Dispatch custom 'mistry:back' event to let any active child modal, sheet, or overlay handle it first
      const backEvt = new CustomEvent('mistry:back', { cancelable: true });
      window.dispatchEvent(backEvt);
      if (backEvt.defaultPrevented) {
        window.history.pushState({ appState: 'view', view: currentViewRef.current }, '');
        return;
      }

      // 1. If any top-level app modal or overlay is open, close it instead of navigating away
      if (modalOpenRef.current) {
        closeAllModals();
        return;
      }

      // 2. If view history stack has previous screens, navigate back to previous screen
      if (viewHistoryRef.current.length > 0) {
        const prev = viewHistoryRef.current.pop();
        if (prev) {
          if (prev.siteId) setSelectedSiteId(prev.siteId);
          if (prev.tab) setCurrentSiteTab(prev.tab as any);
          if (prev.subTab) setCurrentExpenseSubSection(prev.subTab as any);
          setCurrentView(prev.view);
          return;
        }
      }

      // 3. If currently not on dashboard, return to dashboard
      if (currentViewRef.current !== 'dashboard') {
        setCurrentView('dashboard');
        window.history.pushState({ appState: 'root', view: 'dashboard' }, '');
        return;
      }

      // 4. If already on dashboard (root), prevent accidental app exit; require double tap to exit
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        // Double tap confirmed - allow normal browser/OS handling
        return;
      }
      lastBackPressRef.current = now;
      window.history.pushState({ appState: 'root', view: 'dashboard' }, '');
      addToast('Tap back again to exit application', 'info');
    };

    window.addEventListener('popstate', handlePopState);

    // Capacitor native Android back button hook
    let capListener: any = null;
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.App?.addListener) {
        capListener = cap.Plugins.App.addListener('backButton', () => {
          handlePopState(new PopStateEvent('popstate', { state: window.history.state }));
        });
      }
    } catch {
      // not in Capacitor shell
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (capListener && typeof capListener.remove === 'function') {
        capListener.remove();
      }
    };
  }, [closeAllModals]);

  // Navigation Helper with deep tab and sub-tab support
  const handleNavigate = (view: string, siteId?: string, tab?: string, subTab?: string) => {
    setQuickAction(null);
    if (view === 'login' || view === 'auth') return; // already signed in

    const targetView = (PROJECT_VIEWS.includes(view as AppViewName) ? view : view) as AppViewName;
    if (currentView !== targetView) {
      viewHistoryRef.current.push({
        view: currentView,
        siteId: selectedSiteId,
        tab: currentSiteTab,
        subTab: currentExpenseSubSection,
      });
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ appState: 'view', view: targetView }, '');
      }
    }
    if (view === 'site-detail' && siteId) {
      setSelectedSiteId(siteId);
      if (tab) setCurrentSiteTab(tab as any);
      if (subTab) setCurrentExpenseSubSection(subTab as any);
      setCurrentView('site-detail');
    } else if (view === 'trash') {
      setCurrentView('trash');
    } else if (view === 'backup') {
      setCurrentView('backup');
    } else if (view === 'settings') {
      setCurrentView('settings');
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
      setFloorPlanSiteId(siteId || null);
      setCurrentView('floor-plans');
    } else if (view === 'floor-plan-editor') {
      setCurrentView(selectedFloorPlanId ? 'floor-plan-editor' : 'floor-plans');
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
  const handleSoftDelete = (tableName: EntityTable, id: string, displayName: string, onDone?: () => void) => {
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
          onDone?.();
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

  // Project screens (phone stock list, tool room) work on one project: the open one, or the first.
  const projectSiteId = selectedSiteId || userSites[0]?.id || null;
  const phoneStockSiteId = projectSiteId;

  const activeUser = currentUser;

  const navProps = {
    user: activeUser,
    currentView,
    siteId: selectedSiteId,
    onNavigate: (view: string) => handleNavigate(view),
    onOpenClassic: () => { if (selectedSiteId) handleNavigate('site-detail', selectedSiteId, 'overview'); },
    onLogout: handleLogout,
    canInstall: !!installPromptEvent && !isPwaInstalled,
    onInstall: handleInstallPwa,
  };

  // Home screen buttons: open a screen, optionally with its form already started.
  const goFromHome = (view: HomeTarget, action?: QuickAction) => {
    handleNavigate(view);
    if (action) setQuickAction(action);
  };

  return (
    <div className={`app-container ${currentView === 'floor-plan-editor' ? 'm-immersive' : ''}`}>
      <AppShell
        user={activeUser}
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
        projectSwitcher={<ProjectSwitcher sites={userSites} siteId={selectedSiteId} onSelectSite={handleSelectSite} onNewSite={openNewSiteModal} />}
      >
        {/* Main View Router */}
        <main>
        <Suspense fallback={<ViewLoadingFallback />}>
        {/* Phones: today's numbers and quick actions for the open project. */}
        {currentView === 'dashboard' && isPhone && (
          <HomeView
            user={activeUser}
            sites={userSitesQuery}
            siteId={selectedSiteId}
            onGo={goFromHome}
            onNewSite={openNewSiteModal}
            onNotify={addToast}
          />
        )}

        {currentView === 'dashboard' && !isPhone && (
          <DashboardView
            onlySites={false}
            selectedSiteId={selectedSiteId}
            onSelectSite={siteId => {
              setSelectedSiteId(siteId);
            }}
            onOpenSite={siteId => {
              setSelectedSiteId(siteId);
              handleNavigate('site-detail', siteId);
            }}
            onOpenNewSiteModal={openNewSiteModal}
            onEditSite={site => {
              setSiteToEdit(site);
              setSiteModalOpen(true);
            }}
            onDeleteSiteToTrash={site => handleSoftDelete('sites', site.id, site.name)}
            onNotify={addToast}
            user={currentUser}
            onNavigate={(view, siteId, tab, subTab) => handleNavigate(view, siteId, tab, subTab)}
            onOpenMaterialModal={category => {
              setMatCategory(category || 'sand');
              setMatToEdit(null);
              setMatModalOpen(true);
            }}
            onOpenExpenseModal={() => {
              setOtherToEdit(null);
              setOtherModalOpen(true);
            }}
          />
        )}

        {currentView === 'my-sites' && (
          <ProjectsView
            user={currentUser}
            onOpenSite={siteId => {
              setSelectedSiteId(siteId);
              handleNavigate('site-detail', siteId, 'overview');
            }}
            onOpenNewSiteModal={openNewSiteModal}
            onEditSite={site => {
              setSiteToEdit(site);
              setSiteModalOpen(true);
            }}
            onDeleteSiteToTrash={site => handleSoftDelete('sites', site.id, site.name)}
            onNotify={addToast}
            onNavigate={handleNavigate}
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
              setFloorPlanSiteId(siteId);
              setCurrentView('floor-plans');
            }}
            onNotify={addToast}
            onReturnToAdmin={isAdmin(currentUser) ? () => handleNavigate('admin') : undefined}
          />
        )}

        {/* Phones: one-tap attendance (same services as the desktop screen below). */}
        {currentView === 'labour' && isPhone && projectSiteId && (
          <LabourView
            user={activeUser}
            siteId={projectSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenWorker={workerId => {
              setSelectedSiteId(projectSiteId);
              setSelectedWorkerId(workerId);
              handleNavigate('worker');
            }}
            onAddWorker={() => {
              setSelectedSiteId(projectSiteId);
              setWorkerToEdit(null);
              setWorkerModalOpen(true);
            }}
            onNotify={addToast}
          />
        )}

        {currentView === 'labour' && currentUser && !(isPhone && projectSiteId) && (
          <AttendanceSalaryView
            user={currentUser}
            sites={userSites}
            initialSiteId={selectedSiteId}
            onNavigateSiteDetail={(sId, tab) => handleNavigate('site-detail', sId, tab)}
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
            onRemoveWorker={worker => handleSoftDelete('workers', worker.id, worker.name, () => setCurrentView('labour'))}
            onNotify={addToast}
          />
        )}

        {/* Phones get the quick stock list; wider screens the full materials table. Both use domain/stock. */}
        {currentView === 'stock' && currentUser && isPhone && phoneStockSiteId && (
          <StockView
            user={currentUser}
            siteId={phoneStockSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenSteelPurchase={() => {
              setSelectedSiteId(phoneStockSiteId);
              setRodToEdit(null);
              setRodModalOpen(true);
            }}
            onOpenLedger={() => handleNavigate('site-detail', phoneStockSiteId, 'materials')}
            onNotify={addToast}
            startWith={quickAction === 'purchase' ? 'purchase' : undefined}
          />
        )}

        {currentView === 'stock' && currentUser && !(isPhone && phoneStockSiteId) && (
          <MaterialsView
            user={currentUser}
            sites={userSites}
            initialSiteId={selectedSiteId}
            onNavigateSiteDetail={(sId, tab) => handleNavigate('site-detail', sId, tab)}
            onNotify={addToast}
          />
        )}

        {currentView === 'toolroom' && userSitesQuery && !projectSiteId && (
          <div className="m-card m-card-pad" style={{ margin: 16 }}>Add a project first. Tools are kept per project.</div>
        )}
        {/* Same screen at every width; with no project open it uses the first one instead of showing nothing. */}
        {currentView === 'toolroom' && projectSiteId && (
          <ToolRoomView
            user={currentUser}
            siteId={projectSiteId}
            onBack={() => handleNavigate('dashboard')}
            onOpenLedger={() => handleNavigate('site-detail', projectSiteId, 'tools')}
            onNotify={addToast}
            startFilter={quickAction === 'issue-tool' ? 'available' : undefined}
          />
        )}

        {currentView === 'expenses' && (
          <ExpensesView
            user={currentUser}
            siteId={selectedSiteId || ''}
            onBack={() => handleNavigate('dashboard')}
            onOpenLedger={() => handleNavigate('site-detail', selectedSiteId || '', 'expenses')}
            onNotify={addToast}
            startWith={quickAction === 'expense' ? 'add' : undefined}
          />
        )}

        {currentView === 'reports' && (
          <ReportsView siteId={selectedSiteId || ''} onBack={() => handleNavigate('dashboard')} onNotify={addToast} />
        )}

        {currentView === 'floor-plans' && currentUser && (
          <FloorPlanListView
            user={currentUser}
            initialSiteId={floorPlanSiteId}
            onBack={() => (floorPlanSiteId ? handleNavigate('site-detail', floorPlanSiteId) : handleNavigate('dashboard'))}
            onOpenPlan={planId => {
              setSelectedFloorPlanId(planId);
              setCurrentView('floor-plan-editor');
            }}
            onTrashPlan={plan => handleSoftDelete('floorPlans', plan.id, plan.buildingName || 'Floor plan')}
            onNotify={addToast}
          />
        )}

        {currentView === 'floor-plan-editor' && currentUser && selectedFloorPlanId && (
          <FloorPlannerHostView
            planId={selectedFloorPlanId}
            onBack={() => {
              setSelectedFloorPlanId(null);
              setCurrentView('floor-plans');
            }}
            onSendAreaToEstimator={areaSqFt => {
              handleNavigate('estimator');
              setEstimatorAreaSqFt(areaSqFt);
              addToast(`Floor plan area ${areaSqFt.toFixed(0)} sq.ft is set as the building size on one floor`, 'info');
            }}
          />
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

        {currentView === 'settings' && (
          <SettingsView
            user={currentUser}
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
            onNotify={addToast}
            onSignOut={handleLogout}
            signingOut={signingOut}
          />
        )}
        </Suspense>
      </main>
      </AppShell>

      {/* Phones: Home | Labour | Stock | Tools | More */}
      {isPhone && <MobileBottomNav {...navProps} />}

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
                      {site.ownerName} â€¢ {site.area || site.buildingType}
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
        onClose={() => { setIsRecoveryModalOpen(false); onRecoveryHandled(); }}
        onSuccess={msg => addToast(msg, 'success')}
      />

      {/* Post-Authentication Merge Local Sites Dialog (Module 4) */}
      {isMergeModalOpen && mergeTargetUser && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1300 }}
          onClick={() => setIsMergeModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '100%', borderRadius: 16, overflow: 'hidden' }}
          >
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-charcoal)' }}>
                    உள்ளூர் திட்டங்கள் கண்டறியப்பட்டன
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    Local Sites Detected ({localSitesToMerge.length} projects)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                aria-label="Close modal"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-charcoal)', lineHeight: 1.5, margin: '0 0 14px' }}>
                நீங்கள் ஆஃப்லைன் முறையில் உருவாக்கிய <strong>{localSitesToMerge.length} திட்டங்கள்</strong> உள்ளன. அவற்றை உங்கள் கணக்கில் (<strong>{mergeTargetUser.fullName || mergeTargetUser.username}</strong>) இணைக்க விரும்புகிறீர்களா?
              </p>
              <div style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, maxHeight: '140px', overflowY: 'auto' }}>
                {localSitesToMerge.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <strong>{s.name}</strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>{s.location || 'Local'}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: '11px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border-strong)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-charcoal)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  தவிர்க்கவும் (Keep Separate)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      for (const site of localSitesToMerge) {
                        await db.sites.update(site.id, { userId: mergeTargetUser.id, updatedAt: new Date().toISOString() });
                      }
                      addToast(`${localSitesToMerge.length} உள்ளூர் திட்டங்கள் கணக்கில் இணைக்கப்பட்டன!`, 'success');
                      await performFullSync(mergeTargetUser.id);
                    } catch (err: any) {
                      addToast('Merge failed: ' + err.message, 'error');
                    } finally {
                      setIsMergeModalOpen(false);
                      setLocalSitesToMerge([]);
                    }
                  }}
                  style={{
                    flex: 1.5,
                    minHeight: 44,
                    padding: '11px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  இணைக்கவும் (Merge Sites)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Start-up and sign-in gate: splash while the saved sign-in is checked, then the Welcome /
 * Create Account / Log In screens, and the workspace only for a signed-in account.
 */
export function App() {
  const [gate, dispatch] = useReducer(authGateReducer, initialAuthGateState);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  // Read before Supabase tidies the reset link out of the address bar.
  const [recoveryRequested, setRecoveryRequested] = useState(() => checkPasswordRecoveryUrl());

  useEffect(() => {
    let alive = true;
    initAuth()
      .then(user => { if (alive) dispatch({ type: 'RESTORED', user }); })
      .catch(error => {
        if (!alive) return;
        setNotice({ kind: 'error', key: error instanceof InactiveAccountError ? 'auth_err_account_disabled' : 'auth_err_restore' });
        dispatch({ type: 'RESTORED', user: null });
      });

    let unsubscribe = () => {};
    if (isSupabaseConfigured() && supabase) {
      const { data } = supabase.auth.onAuthStateChange(event => {
        if (event === 'PASSWORD_RECOVERY') setRecoveryRequested(true);
        // Signed out elsewhere, the session expired, or the account was disabled.
        if (event === 'SIGNED_OUT' && alive) dispatch({ type: 'SIGNED_OUT' });
      });
      unsubscribe = () => data?.subscription?.unsubscribe();
    }
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await logoutUser();
    setNotice({ kind: 'success', key: 'auth_signed_out' });
    dispatch({ type: 'SIGNED_OUT' });
  };

  if (gate.status === 'checking') return <SplashScreen />;
  if (gate.status !== 'signed-in' || !gate.user) {
    return (
      <LoginView
        notice={notice}
        onSignedIn={user => {
          setNotice(null);
          dispatch({ type: 'SIGNED_IN', user });
        }}
      />
    );
  }
  return (
    <Workspace
      key={gate.user.id}
      user={gate.user}
      justSignedIn={gate.justSignedIn}
      recoveryRequested={recoveryRequested}
      onRecoveryHandled={() => setRecoveryRequested(false)}
      onSignOut={signOut}
    />
  );
}

export default App;

