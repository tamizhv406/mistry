import React, { useState, useEffect } from 'react';
import { db } from './db/db';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Toast, type ToastMessage } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { SiteDetailView } from './views/SiteDetailView';
import { TrashView } from './views/TrashView';
import { BackupView } from './views/BackupView';
import { EstimatorView } from './views/EstimatorView';
import { AdminDashboardView } from './views/AdminDashboardView';

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

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [currentView, setCurrentView] = useState<'dashboard' | 'my-sites' | 'site-detail' | 'trash' | 'backup' | 'estimator' | 'admin'>('dashboard');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initialize Auth table and check active session
  useEffect(() => {
    initAuth().then(() => {
      const u = getCurrentUser();
      if (u) {
        setCurrentUser(u);
      }
    });
  }, []);

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

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    addToast('Signed out of Building Mistry', 'info');
  };

  // Navigation Helper
  const handleNavigate = (view: string, siteId?: string) => {
    if (view === 'site-detail' && siteId) {
      setSelectedSiteId(siteId);
      setCurrentView('site-detail');
    } else if (view === 'trash') {
      setCurrentView('trash');
    } else if (view === 'backup') {
      setCurrentView('backup');
    } else if (view === 'my-sites') {
      setCurrentView('my-sites');
    } else if (view === 'estimator') {
      setCurrentView('estimator');
    } else if (view === 'admin') {
      if (isAdmin(currentUser)) {
        setCurrentView('admin');
      } else {
        addToast('Access denied: Admin Portal is restricted to administrators', 'error');
      }
    } else {
      setSelectedSiteId(null);
      setCurrentView('dashboard');
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
          await db.softDelete(tableName, id);
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
          await db.restoreRecord(item.tableName, item.id);
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
          await db.permanentDelete(item.tableName, item.id);
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
          const trash = await db.getAllTrash();
          for (const item of trash) {
            await db.permanentDelete(item.tableName, item.id);
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

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        selectedSiteId={selectedSiteId}
        onNavigate={handleNavigate}
        onOpenNewSiteModal={() => {
          setSiteToEdit(null);
          setSiteModalOpen(true);
        }}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Router */}
      <main>
        {currentView === 'dashboard' && (
          <DashboardView
            onOpenSite={id => handleNavigate('site-detail', id)}
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

        {currentView === 'my-sites' && (
          <DashboardView
            onlySites={true}
            onOpenSite={id => handleNavigate('site-detail', id)}
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
            onNotify={addToast}
          />
        )}

        {currentView === 'estimator' && (
          <EstimatorView
            onOpenSite={siteId => handleNavigate('site-detail', siteId)}
            onNotify={addToast}
          />
        )}

        {currentView === 'admin' && isAdmin(currentUser) && (
          <AdminDashboardView
            currentUser={currentUser}
            onSelectSite={site => handleNavigate('site-detail', site.id)}
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
            onBack={() => handleNavigate('dashboard')}
            onNotify={addToast}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={currentUser}
      />

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
    </div>
  );
}

export default App;
