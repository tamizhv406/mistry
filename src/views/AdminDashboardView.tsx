import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Building2,
  Layers,
  HardHat,
  Coffee,
  BarChart3,
  Trash2,
  History,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  Crown,
  UserPlus,
  X,
  Lock,
  Mail,
  Phone,
  Sparkles,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  User,
  Site,
  Material,
  LabourWorker,
  TeaSnacksExpense,
  ActivityLog,
  TrashRecord,
  UserRole,
} from '../db/types';
import {
  getAllUsers,
  toggleUserActive,
  isSuperAdmin,
  createSubAdmin,
  changeUserRole,
} from '../services/auth';

interface AdminDashboardViewProps {
  currentUser: User;
  onSelectSite: (site: Site) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  onSelectSite,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    'users' | 'sites' | 'materials' | 'labour' | 'expenses' | 'analytics' | 'audit' | 'trash'
  >('users');

  // Master Data
  const [users, setUsers] = useState<Omit<User, 'passwordHash'>[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [workers, setWorkers] = useState<LabourWorker[]>([]);
  const [teaExpenses, setTeaExpenses] = useState<TeaSnacksExpense[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [trashItems, setTrashItems] = useState<TrashRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContractorFilter, setSelectedContractorFilter] = useState<string>('ALL');

  // Sub-Admin Creation Modal State
  const [isSubAdminModalOpen, setIsSubAdminModalOpen] = useState(false);
  const [subAdminFullName, setSubAdminFullName] = useState('');
  const [subAdminUsername, setSubAdminUsername] = useState('');
  const [subAdminMobile, setSubAdminMobile] = useState('');
  const [subAdminEmail, setSubAdminEmail] = useState('');
  const [subAdminPassword, setSubAdminPassword] = useState('');
  const [subAdminError, setSubAdminError] = useState('');
  const [isCreatingSubAdmin, setIsCreatingSubAdmin] = useState(false);
  const [roleChangingUserId, setRoleChangingUserId] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [uList, sList, mList, wList, tList, aList, trList] = await Promise.all([
        getAllUsers(currentUser),
        db.sites.toArray(),
        db.materials.toArray(),
        db.workers.toArray(),
        db.teaSnacksExpenses.toArray(),
        db.activityLogs.reverse().limit(100).toArray(),
        db.getAllTrash(currentUser),
      ]);

      setUsers(uList);
      setSites(sList.filter(s => !s.isDeleted));
      setMaterials(mList.filter(m => !m.isDeleted));
      setWorkers(wList.filter(w => !w.isDeleted));
      setTeaExpenses(tList.filter(t => !t.isDeleted));
      setAuditLogs(aList);
      setTrashItems(trList);
    } catch (err: any) {
      onShowToast('Failed to load admin data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleUserStatus = async (targetUser: Omit<User, 'passwordHash'>) => {
    const newStatus = !targetUser.isActive;
    const res = await toggleUserActive(currentUser, targetUser.id, newStatus);
    if (res.success) {
      onShowToast(
        `User ${targetUser.fullName} has been ${newStatus ? 'activated' : 'deactivated'}`,
        'success'
      );
      loadAdminData();
    } else {
      onShowToast(res.error || 'Failed to update user', 'error');
    }
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subAdminUsername.trim() || subAdminUsername.length < 3) {
      setSubAdminError('Username must be at least 3 characters.');
      return;
    }
    if (!subAdminPassword || subAdminPassword.length < 6) {
      setSubAdminError('Password must be at least 6 characters.');
      return;
    }

    setIsCreatingSubAdmin(true);
    setSubAdminError('');
    try {
      const res = await createSubAdmin(currentUser, {
        fullName: subAdminFullName,
        username: subAdminUsername,
        mobile: subAdminMobile,
        email: subAdminEmail,
        password: subAdminPassword,
      });

      if (res.success && res.user) {
        onShowToast(`Sub-Admin "${res.user.fullName}" created successfully!`, 'success');
        setIsSubAdminModalOpen(false);
        setSubAdminFullName('');
        setSubAdminUsername('');
        setSubAdminMobile('');
        setSubAdminEmail('');
        setSubAdminPassword('');
        await loadAdminData();
      } else {
        setSubAdminError(res.error || 'Failed to create Sub-Admin');
      }
    } catch (err: any) {
      setSubAdminError(err.message || 'Error creating Sub-Admin');
    } finally {
      setIsCreatingSubAdmin(false);
    }
  };

  const handlePromoteToSubAdmin = async (targetUser: Omit<User, 'passwordHash'>) => {
    if (
      !window.confirm(
        `Are you sure you want to promote ${targetUser.fullName} to Sub-Admin? They will have supervisory access to all sites.`
      )
    ) {
      return;
    }
    setRoleChangingUserId(targetUser.id);
    try {
      const res = await changeUserRole(currentUser, targetUser.id, 'SUB_ADMIN');
      if (res.success) {
        onShowToast(`${targetUser.fullName} is now a Sub-Admin!`, 'success');
        await loadAdminData();
      } else {
        onShowToast(res.error || 'Failed to update role', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update role', 'error');
    } finally {
      setRoleChangingUserId(null);
    }
  };

  const handleDemoteToMistry = async (targetUser: Omit<User, 'passwordHash'>) => {
    if (
      !window.confirm(
        `Are you sure you want to demote ${targetUser.fullName} back to Mistry? They will only be able to view their own sites.`
      )
    ) {
      return;
    }
    setRoleChangingUserId(targetUser.id);
    try {
      const res = await changeUserRole(currentUser, targetUser.id, 'MISTRY');
      if (res.success) {
        onShowToast(`${targetUser.fullName} demoted to Mistry.`, 'info');
        await loadAdminData();
      } else {
        onShowToast(res.error || 'Failed to update role', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update role', 'error');
    } finally {
      setRoleChangingUserId(null);
    }
  };

  // Map userId to User FullName
  const userMap = new Map<string, string>();
  users.forEach(u => userMap.set(u.id, `${u.fullName} (${u.username})`));

  // Filtered Sites
  const filteredSites = sites.filter(s => {
    const matchesUser =
      selectedContractorFilter === 'ALL' || s.userId === selectedContractorFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.area.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUser && matchesSearch;
  });

  // Global Financial Analytics
  const totalSitesCount = sites.length;
  const activeSitesCount = sites.filter(s => s.status === 'Active').length;
  const completedSitesCount = sites.filter(s => s.status === 'Completed').length;
  const totalMaterialsSpend = materials.reduce((acc, m) => acc + (m.totalAmount || 0), 0);
  const totalWorkersCount = workers.length;
  const totalRefreshmentsSpend = teaExpenses.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
  const totalTeaSpend = teaExpenses.reduce((acc, t) => acc + (t.teaExpense || 0), 0);
  const totalJuiceSpend = teaExpenses.reduce((acc, t) => acc + (t.juiceExpense || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Admin Portal Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
              isSuperAdmin(currentUser)
                ? 'bg-amber-500/20 border-2 border-amber-500/50 text-amber-400'
                : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
            }`}>
              {isSuperAdmin(currentUser) ? <Crown className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                  Central Admin Portal
                </h1>
                {isSuperAdmin(currentUser) ? (
                  <span className="bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    👑 Real Admin (Tamil Thilagan)
                  </span>
                ) : (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    🛡️ Sub-Admin View
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {isSuperAdmin(currentUser)
                  ? 'Master governance: create sub-admins, manage permissions, oversee all sites & financial ledgers.'
                  : 'Full supervisory governance across all mistries, construction sites, financial ledgers, and audit logs.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isSuperAdmin(currentUser) && (
              <button
                onClick={() => {
                  setSubAdminError('');
                  setIsSubAdminModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
              >
                <UserPlus className="w-4 h-4 text-slate-950" />
                <span>➕ Create Sub-Admin (துணை அட்மின்)</span>
              </button>
            )}

            <button
              onClick={loadAdminData}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Master Data</span>
            </button>
          </div>
        </div>

        {/* Global Key Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-indigo-500/20">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Registered Users
            </span>
            <span className="text-xl font-black text-indigo-400">{users.length}</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Sites
            </span>
            <span className="text-xl font-black text-amber-400">{totalSitesCount}</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Sites
            </span>
            <span className="text-xl font-black text-emerald-400">{activeSitesCount}</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Workers
            </span>
            <span className="text-xl font-black text-sky-400">{totalWorkersCount}</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Materials Spend
            </span>
            <span className="text-xl font-black text-slate-100">
              ₹{(totalMaterialsSpend / 100000).toFixed(2)}L
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Refreshments Spend
            </span>
            <span className="text-xl font-black text-orange-400">
              ₹{totalRefreshmentsSpend.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800 no-scrollbar">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Access ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'sites'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>All Sites Master ({sites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'materials'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Materials Ledger ({materials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('labour')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'labour'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <HardHat className="w-4 h-4" />
          <span>Workers & Labour ({workers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>Refreshments & Expenses</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Global Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'trash'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Global Trash ({trashItems.length})</span>
        </button>
      </div>

      {/* 1. USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Registered Building Mistries & Contractors
              </h2>
              <p className="text-xs text-slate-400">
                Manage accounts, activate or deactivate access. Passwords are securely hashed and never displayed.
              </p>
            </div>
            <div className="text-xs text-slate-400">
              Total Accounts: <strong className="text-slate-200">{users.length}</strong>
            </div>
          </div>

          {/* Real Admin Control Center Banner */}
          {isSuperAdmin(currentUser) && (
            <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                    <span>Real Admin Governance (உண்மையான அட்மின்)</span>
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 uppercase">
                      Master Key
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Logged in as <strong>{currentUser.email}</strong>. Only you have master rights to create Sub-Admins, promote mistries, or demote supervisors.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSubAdminError('');
                  setIsSubAdminModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 whitespace-nowrap active:scale-95 transition-all"
              >
                <UserPlus className="w-4 h-4 text-slate-950" />
                <span>Create Sub-Admin (துணை அட்மின்)</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(u => {
              const userSites = sites.filter(s => s.userId === u.id);
              const isThisRealAdmin =
                u.email?.toLowerCase() === 'tamilthilagan82@gmail.com' || u.role === 'SUPER_ADMIN';
              const isThisSubAdmin = u.role === 'SUB_ADMIN';
              const isThisAdmin = u.role === 'ADMIN';

              return (
                <div
                  key={u.id}
                  className={`bg-slate-900/90 border rounded-2xl p-5 space-y-4 shadow-lg transition-all ${
                    isThisRealAdmin
                      ? 'border-amber-500/60 ring-2 ring-amber-500/20 shadow-amber-500/10'
                      : isThisSubAdmin
                      ? 'border-purple-500/50 ring-1 ring-purple-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg ${
                          isThisRealAdmin
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                            : isThisSubAdmin
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {isThisRealAdmin ? <Crown className="w-5 h-5" /> : u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-slate-100 text-sm">{u.fullName}</h3>
                          {isThisRealAdmin && (
                            <span title="Real Admin Master" className="text-amber-400 text-xs">
                              👑
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-400">@{u.username}</span>
                      </div>
                    </div>

                    {isThisRealAdmin ? (
                      <span className="bg-gradient-to-r from-amber-500/25 to-amber-600/25 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <Crown className="w-3 h-3 text-amber-400" />
                        👑 Real Admin
                      </span>
                    ) : isThisSubAdmin ? (
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-purple-400" />
                        🛡️ Sub-Admin
                      </span>
                    ) : isThisAdmin ? (
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Admin
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Mistry
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                    <div className="flex justify-between">
                      <span>Mobile:</span>
                      <strong className="text-slate-200">{u.mobile || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <strong className="text-slate-200">{u.email || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Sites Managed:</span>
                      <strong className="text-amber-400">{userSites.length} Sites</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Account Status:</span>
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          u.isActive !== false ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {u.isActive !== false ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Deactivated
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                    <button
                      onClick={() => {
                        setSelectedContractorFilter(u.id);
                        setActiveTab('sites');
                      }}
                      className="flex-1 min-w-[120px] py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspect Sites ({userSites.length})</span>
                    </button>

                    {/* Role Management Actions (Only Real Admin can promote/demote) */}
                    {isSuperAdmin(currentUser) && !isThisRealAdmin && (
                      <>
                        {u.role === 'MISTRY' ? (
                          <button
                            onClick={() => handlePromoteToSubAdmin(u)}
                            disabled={roleChangingUserId === u.id}
                            className="py-1.5 px-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                            title="Promote to Sub-Admin (Supervisory access to all sites)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                            <span>Make Sub-Admin</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDemoteToMistry(u)}
                            disabled={roleChangingUserId === u.id}
                            className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                            title="Demote to standard Mistry (only own sites)"
                          >
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            <span>Demote to Mistry</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Deactivate/Activate button (Real Admin can never be deactivated) */}
                    {!isThisRealAdmin && u.id !== currentUser.id && (
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                          u.isActive !== false
                            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {u.isActive !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    )}

                    {isThisRealAdmin && (
                      <span className="text-[11px] font-semibold text-amber-400/90 flex items-center gap-1 py-1 px-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        Permanent Master
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SITES MASTER TAB */}
      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter sites by name, owner, area..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={selectedContractorFilter}
                onChange={e => setSelectedContractorFilter(e.target.value)}
                className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Contractors & Mistries</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Showing <strong className="text-slate-200">{filteredSites.length}</strong> of {sites.length} sites
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSites.map(site => {
              const contractorName = userMap.get(site.userId) || 'Head Mistry';
              return (
                <div
                  key={site.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm hover:text-amber-400 transition-colors cursor-pointer" onClick={() => onSelectSite(site)}>
                        {site.name}
                      </h3>
                      <span className="text-xs text-slate-400">{site.buildingType}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        site.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : site.status === 'Completed'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {site.status}
                    </span>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Contractor / Mistry:</span>
                    <strong className="text-indigo-300">{contractorName}</strong>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Owner:</span>
                      <strong className="text-slate-200">{site.ownerName} ({site.ownerPhone || '—'})</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Area:</span>
                      <strong className="text-slate-200">{site.area || site.address || '—'}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onSelectSite(site)}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Site Master View</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MATERIALS MASTER LEDGER */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Cross-Site Materials Master Ledger</h2>
              <p className="text-xs text-slate-400">Consolidated procurement records across all sites.</p>
            </div>
            <div className="text-sm font-bold text-amber-400">
              Total: ₹{totalMaterialsSpend.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Material Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {materials.slice(0, 50).map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">{m.purchaseDate}</td>
                    <td className="p-3 font-semibold text-slate-100">{m.materialName}</td>
                    <td className="p-3 uppercase text-[10px] text-amber-400 font-bold">{m.category}</td>
                    <td className="p-3">{m.supplier || '—'}</td>
                    <td className="p-3 font-bold">{m.quantity} {m.unit}</td>
                    <td className="p-3 font-bold text-slate-100">₹{m.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-emerald-400 font-semibold">₹{m.paidAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-rose-400 font-semibold">₹{m.balance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LABOUR & WORKERS TAB */}
      {activeTab === 'labour' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Registered Workers & Labour Master</h2>
              <p className="text-xs text-slate-400">Total active workers deployed across all active sites.</p>
            </div>
            <div className="text-sm font-bold text-sky-400">
              {workers.length} Active Workers
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {workers.map(w => (
              <div key={w.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-100 text-sm">{w.name}</h4>
                  <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-semibold">
                    {w.category}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>Phone: <strong className="text-slate-300">{w.phone || '—'}</strong></div>
                  <div>Daily Wage: <strong className="text-emerald-400">₹{w.dailyWage}/day</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. REFRESHMENTS & EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-400 font-semibold block">☕ Total Tea & Coffee</span>
                <span className="text-2xl font-black text-slate-100">
                  ₹{totalTeaSpend.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-3xl">☕</span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-400 font-semibold block">🧃 Total Fresh Juice</span>
                <span className="text-2xl font-black text-slate-100">
                  ₹{totalJuiceSpend.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-3xl">🧃</span>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-indigo-400 font-semibold block">Consolidated Total</span>
                <span className="text-2xl font-black text-slate-100">
                  ₹{totalRefreshmentsSpend.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-3xl">🍪</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">☕ Tea</th>
                  <th className="p-3">🍪 Snacks</th>
                  <th className="p-3">🧃 Juice</th>
                  <th className="p-3">Total Daily</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Balance</th>
                  <th className="p-3">Stall / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {teaExpenses.slice(0, 50).map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono">{t.date}</td>
                    <td className="p-3 font-semibold">₹{(t.teaExpense || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-semibold">₹{(t.snacksExpense || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-bold text-emerald-400">₹{(t.juiceExpense || 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-bold text-slate-100">₹{t.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-emerald-400">₹{t.paidAmount.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-rose-400 font-bold">₹{t.balance.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-slate-400">{t.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. GLOBAL ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
            <h2 className="text-base font-bold text-slate-100 mb-2">Cross-Contractor Financial Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Materials Procurement</span>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  ₹{totalMaterialsSpend.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Refreshments (Tea / Juice / Snacks)</span>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  ₹{totalRefreshmentsSpend.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Active Construction Sites</span>
                <div className="text-2xl font-black text-sky-400 mt-1">
                  {activeSitesCount} of {totalSitesCount} Sites Active
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">System Activity & Audit Trail</h2>
              <p className="text-xs text-slate-400">Timestamped record of all logins, changes, and admin actions.</p>
            </div>
            <div className="text-xs text-slate-400">
              Showing last <strong className="text-slate-200">{auditLogs.length}</strong> events
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Site / Target</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{log.userName || 'System'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {log.userRole || 'USER'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-amber-400">{log.action}</td>
                    <td className="p-3 text-slate-300">{log.siteName || '—'}</td>
                    <td className="p-3 text-slate-400">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. GLOBAL TRASH RECOVERY */}
      {activeTab === 'trash' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Global Trash & Recovery Bin</h2>
              <p className="text-xs text-slate-400">
                As Chief Administrator, you can view and restore deleted records across all mistries and sites.
              </p>
            </div>
            <div className="text-xs text-slate-400">
              Deleted Records: <strong className="text-slate-200">{trashItems.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Deleted Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Contractor</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trashItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-[11px]">{new Date(item.deletedAt).toLocaleDateString('en-IN')}</td>
                    <td className="p-3 uppercase font-bold text-[10px] text-amber-400">{item.entityType}</td>
                    <td className="p-3 font-semibold text-slate-200">{item.userName || 'Mistry'}</td>
                    <td className="p-3 font-semibold text-slate-100">{item.title}</td>
                    <td className="p-3 text-slate-400">{item.siteName || '—'}</td>
                    <td className="p-3">
                      <button
                        onClick={async () => {
                          try {
                            await db.restoreRecordForUser(currentUser, item.tableName, item.id);
                            onShowToast(`Restored "${item.title}" successfully`, 'success');
                            loadAdminData();
                          } catch (err: any) {
                            onShowToast(err.message || 'Restore failed', 'error');
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
                {trashItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-6 text-slate-500">
                      Recycle bin is completely empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Sub-Admin Modal (Real Admin Exclusive) */}
      {isSubAdminModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsSubAdminModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-dialog max-w-md w-full"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="modal-header bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900 border-b border-purple-500/30 p-4">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#f1f5f9' }}>
                <ShieldCheck size={22} color="#c084fc" />
                <span>Create New Sub-Admin (துணை அட்மின் உருவாக்கம்)</span>
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsSubAdminModalOpen(false)}
                type="button"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubAdmin} className="modal-form-container">
              <div className="modal-body space-y-4 p-5">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3.5 text-xs text-purple-300 flex items-start gap-2.5">
                  <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-100 font-bold mb-0.5">
                      Real Admin Authority (உண்மையான அட்மின் அனுமதி):
                    </strong>
                    Sub-Admins receive elevated supervisory oversight across all construction sites, materials, and worker attendance ledgers. However, they cannot create or modify other admins.
                  </div>
                </div>

                {subAdminError && (
                  <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{subAdminError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Full Name (முழு பெயர்)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S. Kumar (Site Supervisor)"
                    value={subAdminFullName}
                    onChange={e => setSubAdminFullName(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Username (பயனர் பெயர்)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. kumar_subadmin"
                    value={subAdminUsername}
                    onChange={e => setSubAdminUsername(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-purple-400" />
                      <span>Mobile (தொலைபேசி)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 98401 55667"
                      value={subAdminMobile}
                      onChange={e => setSubAdminMobile(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-purple-400" />
                      <span>Email (மின்னஞ்சல்)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. kumar@mistry.com"
                      value={subAdminEmail}
                      onChange={e => setSubAdminEmail(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Password (கடவுச்சொல் - min 6 chars)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Enter safe password"
                    value={subAdminPassword}
                    onChange={e => setSubAdminPassword(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="modal-footer flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setIsSubAdminModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Cancel (ரத்து செய்)
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSubAdmin}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isCreatingSubAdmin ? 'Creating...' : 'Create Sub-Admin (உருவாக்கு)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
