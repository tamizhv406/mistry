import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Building2,
  Layers,
  HardHat,
  CalendarCheck,
  Wallet,
  Banknote,
  Wrench,
  Coffee,
  Receipt,
  MessageSquare,
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
  Crown,
  UserPlus,
  X,
  Lock,
  Mail,
  Phone,
  KeyRound,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  User,
  Site,
  Material,
  LabourWorker,
  AttendanceRecord,
  SalaryPayment,
  LabourAdvance,
  ToolItem,
  TeaSnacksExpense,
  PoojaExpense,
  ElectricityBill,
  WaterBill,
  OtherExpense,
  SiteComment,
  BuildingEstimate,
  AdminAuditLog,
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
  adminResetUserPassword,
  type AdminUserListItem,
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
    | 'users'
    | 'sites'
    | 'materials'
    | 'labour'
    | 'attendance'
    | 'salary'
    | 'advances'
    | 'tools'
    | 'expenses'
    | 'bills'
    | 'comments'
    | 'reports'
    | 'trash'
    | 'audit'
  >('users');

  // Master Data
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [workers, setWorkers] = useState<LabourWorker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [advances, setAdvances] = useState<LabourAdvance[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [teaExpenses, setTeaExpenses] = useState<TeaSnacksExpense[]>([]);
  const [poojaExpenses, setPoojaExpenses] = useState<PoojaExpense[]>([]);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([]);
  const [electricityBills, setElectricityBills] = useState<ElectricityBill[]>([]);
  const [waterBills, setWaterBills] = useState<WaterBill[]>([]);
  const [siteComments, setSiteComments] = useState<SiteComment[]>([]);
  const [estimates, setEstimates] = useState<BuildingEstimate[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [securityAuditLogs, setSecurityAuditLogs] = useState<AdminAuditLog[]>([]);
  const [trashItems, setTrashItems] = useState<TrashRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContractorFilter, setSelectedContractorFilter] = useState<string>('ALL');

  // Drilldown Modal: Inspect User Sites
  const [inspectingUser, setInspectingUser] = useState<AdminUserListItem | null>(null);

  // Password Reset Assist Modal State
  const [resetModalUser, setResetModalUser] = useState<AdminUserListItem | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

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
      const [
        uList,
        sList,
        mList,
        wList,
        attList,
        salList,
        advList,
        toolsList,
        tList,
        pList,
        oList,
        eList,
        wtList,
        cList,
        estList,
        aList,
        secAuditList,
        trList,
      ] = await Promise.all([
        getAllUsers(currentUser),
        db.sites.toArray(),
        db.materials.toArray(),
        db.workers.toArray(),
        db.attendance.toArray(),
        db.salaryPayments.toArray(),
        db.labourAdvances.toArray(),
        db.tools.toArray(),
        db.teaSnacksExpenses.toArray(),
        db.poojaExpenses.toArray(),
        db.otherExpenses.toArray(),
        db.electricityBills.toArray(),
        db.waterBills.toArray(),
        db.siteComments.toArray(),
        db.estimates.toArray(),
        db.activityLogs.reverse().limit(100).toArray(),
        db.getAllAdminAuditLogs ? db.getAllAdminAuditLogs(currentUser) : Promise.resolve([]),
        db.getAllTrash(currentUser),
      ]);

      setUsers(uList);
      setSites(sList.filter(s => !s.isDeleted));
      setMaterials(mList.filter(m => !m.isDeleted));
      setWorkers(wList.filter(w => !w.isDeleted));
      setAttendance(attList.filter(a => !a.isDeleted));
      setSalaries(salList.filter(sp => !sp.isDeleted));
      setAdvances(advList.filter(adv => !adv.isDeleted));
      setTools(toolsList.filter(t => !t.isDeleted));
      setTeaExpenses(tList.filter(t => !t.isDeleted));
      setPoojaExpenses(pList.filter(p => !p.isDeleted));
      setOtherExpenses(oList.filter(o => !o.isDeleted));
      setElectricityBills(eList.filter(e => !e.isDeleted));
      setWaterBills(wtList.filter(w => !w.isDeleted));
      setSiteComments(cList.filter(c => !c.isDeleted));
      setEstimates(estList.filter(est => !est.isDeleted));
      setActivityLogs(aList);
      setSecurityAuditLogs(secAuditList || []);
      setTrashItems(trList);
    } catch (err: any) {
      onShowToast('Failed to load master admin data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleUserStatus = async (targetUser: AdminUserListItem) => {
    const newStatus = !targetUser.isActive;
    const res = await toggleUserActive(currentUser, targetUser.id, newStatus);
    if (res.success) {
      onShowToast(
        `User ${targetUser.fullName} has been ${newStatus ? 'activated' : 'deactivated'}`,
        'success'
      );
      loadAdminData();
    } else {
      onShowToast(res.error || 'Failed to update user status', 'error');
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

  const handlePromoteToSubAdmin = async (targetUser: AdminUserListItem) => {
    if (
      !window.confirm(
        `Are you sure you want to promote ${targetUser.fullName} to Sub-Admin? They will receive supervisory access across all sites.`
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

  const handleDemoteToMistry = async (targetUser: AdminUserListItem) => {
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

  // Password Reset Assist Handlers
  const handleOpenResetAssist = (user: AdminUserListItem) => {
    setResetModalUser(user);
    setTempPassword(`Mistry@${Math.floor(1000 + Math.random() * 9000)}`);
    setResetError('');
    setResetSuccessMessage('');
    setCopiedPassword(false);
  };

  const handleExecutePasswordResetAssist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (tempPassword.length < 8) {
      setResetError('Temporary password must be at least 8 characters.');
      return;
    }
    setIsResettingPassword(true);
    setResetError('');
    try {
      const res = await adminResetUserPassword(currentUser, resetModalUser.id, tempPassword);
      if (res.success) {
        setResetSuccessMessage(
          `Password reset successful! Provide the temporary password below to ${resetModalUser.fullName}. They will be forced to change it on their next login.`
        );
        onShowToast(`Password reset assist completed for ${resetModalUser.fullName}`, 'success');
        await loadAdminData();
      } else {
        setResetError(res.error || 'Failed to reset user password.');
      }
    } catch (err: any) {
      setResetError(err.message || 'Error occurred while resetting password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
    onShowToast('Temporary password copied to clipboard!', 'info');
  };

  // Maps for fast lookups
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => map.set(u.id, `${u.fullName} (@${u.username})`));
    return map;
  }, [users]);

  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach(s => map.set(s.id, s));
    return map;
  }, [sites]);

  const workerMap = useMemo(() => {
    const map = new Map<string, LabourWorker>();
    workers.forEach(w => map.set(w.id, w));
    return map;
  }, [workers]);

  // Filtered Sites
  const filteredSites = useMemo(() => {
    return sites.filter(s => {
      const matchesUser =
        selectedContractorFilter === 'ALL' || s.userId === selectedContractorFilter;
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.area.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesUser && matchesSearch;
    });
  }, [sites, selectedContractorFilter, searchQuery]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      return (
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.mobile && u.mobile.includes(searchQuery))
      );
    });
  }, [users, searchQuery]);

  // Global Financial Analytics
  const totalSitesCount = sites.length;
  const activeSitesCount = sites.filter(s => s.status === 'Active').length;
  const totalMaterialsSpend = materials.reduce((acc, m) => acc + (m.totalAmount || 0), 0);
  const totalSalariesPaid = salaries.reduce((acc, sp) => acc + (sp.paidAmount || 0), 0);
  const totalAdvancesGiven = advances.reduce((acc, adv) => acc + (adv.amount || 0), 0);
  const totalWorkersCount = workers.length;
  const totalRefreshmentsSpend = teaExpenses.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
  const totalPoojaSpend = poojaExpenses.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
  const totalOtherSpend = otherExpenses.reduce((acc, o) => acc + (o.amount || 0), 0);
  const totalBillsSpend =
    electricityBills.reduce((acc, b) => acc + (b.billAmount || 0), 0) +
    waterBills.reduce((acc, w) => acc + (w.billAmount || 0), 0);

  const totalAppGrandExpense =
    totalMaterialsSpend +
    totalSalariesPaid +
    totalRefreshmentsSpend +
    totalPoojaSpend +
    totalOtherSpend +
    totalBillsSpend;

  return (
    <div className="space-y-6 pb-16">
      {/* Admin Portal Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${
                isSuperAdmin(currentUser)
                  ? 'bg-amber-500/20 border-2 border-amber-500/50 text-amber-400'
                  : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
              }`}
            >
              {isSuperAdmin(currentUser) ? <Crown className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                  Super Admin Governance
                </h1>
                {isSuperAdmin(currentUser) ? (
                  <span className="bg-gradient-to-r from-amber-500/30 to-amber-600/30 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    👑 Application Owner (Super Admin)
                  </span>
                ) : (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    🛡️ Administrator Portal
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Centralized multi-contractor command center: oversee users, inspect construction sites, manage ledgers, and audit security events.
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
                <span>Create Sub-Admin (துணை அட்மின்)</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-indigo-500/20">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Registered Mistries
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
              Materials Total
            </span>
            <span className="text-xl font-black text-slate-100">
              ₹{(totalMaterialsSpend / 100000).toFixed(2)}L
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Grand Project Spend
            </span>
            <span className="text-xl font-black text-emerald-400">
              ₹{(totalAppGrandExpense / 100000).toFixed(2)}L
            </span>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs: 13 Core Sections + Audit Log */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800 no-scrollbar">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'sites'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Sites ({sites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'materials'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Materials ({materials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('labour')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'labour'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <HardHat className="w-3.5 h-3.5" />
          <span>Labour ({workers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>Attendance ({attendance.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('salary')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'salary'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Salary ({salaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('advances')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'advances'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span>Advances ({advances.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'tools'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Tools ({tools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>Expenses</span>
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'bills'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Bills ({electricityBills.length + waterBills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'comments'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Comments ({siteComments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'trash'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Trash ({trashItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Security Audit ({securityAuditLogs.length + activityLogs.length})</span>
        </button>
      </div>

      {/* 1. USERS SECTION */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Contractor & Mistry User Management</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {users.length} registered
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect accounts, drill down into contractor sites, assist with password reset, or toggle account status. Passwords are never shown.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map(u => {
              const isThisRealAdmin =
                u.email?.toLowerCase() === 'tamilthilagan82@gmail.com' || u.role === 'SUPER_ADMIN';
              const isThisSubAdmin = u.role === 'SUB_ADMIN';

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
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
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
                          {isThisRealAdmin && <span title="Real Admin Master" className="text-amber-400 text-xs">👑</span>}
                        </div>
                        <span className="text-xs font-mono text-slate-400">@{u.username}</span>
                      </div>
                    </div>

                    {isThisRealAdmin ? (
                      <span className="bg-gradient-to-r from-amber-500/25 to-amber-600/25 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
                        Super Admin
                      </span>
                    ) : isThisSubAdmin ? (
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Sub-Admin
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Mistry
                      </span>
                    )}
                  </div>

                  {/* User Profile Details Table */}
                  <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                    <div className="flex justify-between">
                      <span>Phone:</span>
                      <strong className="text-slate-200">{u.mobile || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <strong className="text-slate-200 truncate max-w-[200px]" title={u.email}>{u.email || '—'}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Status:</span>
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
                            Inactive
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created Date:</span>
                      <strong className="text-slate-300 font-mono text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Login:</span>
                      <strong className="text-slate-300 font-mono text-[11px]">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Sites Count:</span>
                      <strong className="text-amber-400">{u.sitesCount} Sites</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Expenses:</span>
                      <strong className="text-emerald-400 font-bold">
                        ₹{(u.totalExpenses || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInspectingUser(u)}
                        className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>View Sites ({u.sitesCount})</span>
                      </button>

                      {!isThisRealAdmin && (
                        <button
                          onClick={() => handleOpenResetAssist(u)}
                          className="py-1.5 px-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                          title="Assist contractor with temporary password reset"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Reset Assist</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Role Management Actions (Super Admin Exclusive) */}
                      {isSuperAdmin(currentUser) && !isThisRealAdmin && (
                        <>
                          {u.role === 'MISTRY' ? (
                            <button
                              onClick={() => handlePromoteToSubAdmin(u)}
                              disabled={roleChangingUserId === u.id}
                              className="py-1 px-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all"
                            >
                              <ShieldCheck className="w-3 h-3 text-purple-400" />
                              <span>Make Sub-Admin</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDemoteToMistry(u)}
                              disabled={roleChangingUserId === u.id}
                              className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all"
                            >
                              <Users className="w-3 h-3 text-amber-400" />
                              <span>Demote to Mistry</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Enable / Disable User */}
                      {!isThisRealAdmin && u.id !== currentUser.id && (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`py-1 px-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            u.isActive !== false
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {u.isActive !== false ? 'Disable User' : 'Enable User'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SITES SECTION */}
      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search sites by name, owner, area..."
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
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3
                          className="font-bold text-slate-100 text-sm hover:text-amber-400 transition-colors cursor-pointer"
                          onClick={() => onSelectSite(site)}
                        >
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

                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Mistry / Contractor:</span>
                      <strong className="text-indigo-300">{contractorName}</strong>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Owner:</span>
                        <strong className="text-slate-200">{site.ownerName} ({site.ownerPhone || '—'})</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Area / Address:</span>
                        <strong className="text-slate-200">{site.area || site.address || '—'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Budget:</span>
                        <strong className="text-amber-400">
                          {(site as any).estimatedBudget ? `₹${(site as any).estimatedBudget.toLocaleString('en-IN')}` : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => onSelectSite(site)}
                      className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-950" />
                      <span>Select Site (Enter Site Dashboard)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MATERIALS SECTION */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Cross-Site Materials Master Ledger</h2>
              <p className="text-xs text-slate-400">Consolidated procurement records across all construction sites.</p>
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
                  <th className="p-3">Site</th>
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
                {materials.slice(0, 50).map(m => {
                  const s = siteMap.get(m.siteId);
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{m.purchaseDate}</td>
                      <td className="p-3 font-semibold text-amber-400">
                        {s ? (
                          <button
                            onClick={() => onSelectSite(s)}
                            className="hover:underline text-left"
                            title="Open site dashboard"
                          >
                            {s.name}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-100">{m.materialName}</td>
                      <td className="p-3 uppercase text-[10px] text-indigo-400 font-bold">{m.category}</td>
                      <td className="p-3">{m.supplier || '—'}</td>
                      <td className="p-3 font-bold">{m.quantity} {m.unit}</td>
                      <td className="p-3 font-bold text-slate-100">₹{m.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-emerald-400 font-semibold">₹{m.paidAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-rose-400 font-semibold">₹{m.balance.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LABOUR SECTION */}
      {activeTab === 'labour' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Labour & Workers Master Roster</h2>
              <p className="text-xs text-slate-400">Registered construction workers across all projects.</p>
            </div>
            <div className="text-sm font-bold text-sky-400">
              {workers.length} Active Workers
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {workers.map(w => {
              const s = siteMap.get(w.siteId);
              return (
                <div key={w.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-100 text-sm">{w.name}</h4>
                    <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-semibold">
                      {w.category}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>Site: <strong className="text-slate-200">{s ? s.name : '—'}</strong></div>
                    <div>Phone: <strong className="text-slate-300">{w.phone || '—'}</strong></div>
                    <div>Daily Wage: <strong className="text-emerald-400">₹{w.dailyWage}/day</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. ATTENDANCE SECTION */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Cross-Site Daily Attendance Ledger</h2>
              <p className="text-xs text-slate-400">Live attendance status across all active construction sites.</p>
            </div>
            <div className="text-xs text-slate-400">
              Showing last <strong className="text-slate-200">{Math.min(attendance.length, 50)}</strong> records
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Worker Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Shift Units</th>
                  <th className="p-3">Overtime</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attendance.slice(0, 50).map(att => {
                  const s = siteMap.get(att.siteId);
                  const w = workerMap.get(att.workerId);
                  return (
                    <tr key={att.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{att.date}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3 font-semibold text-slate-100">{w ? w.name : att.workerId}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.status === 'present'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : att.status === 'half_day'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {att.status === 'half_day' ? 'Half Day' : att.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-200">{att.dayMultiplier} Shift</td>
                      <td className="p-3">{att.overtimeHours ? `${att.overtimeHours} hrs` : '—'}</td>
                      <td className="p-3 text-slate-400">{att.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. SALARY SECTION */}
      {activeTab === 'salary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Cross-Site Salary Disbursal Ledger</h2>
              <p className="text-xs text-slate-400">Consolidated worker salary payments across all sites.</p>
            </div>
            <div className="text-sm font-bold text-emerald-400">
              Total Paid: ₹{totalSalariesPaid.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Worker Name</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Payment Mode</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {salaries.slice(0, 50).map(sal => {
                  const s = siteMap.get(sal.siteId);
                  const w = workerMap.get(sal.workerId);
                  return (
                    <tr key={sal.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{sal.date}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3 font-semibold text-slate-100">{w ? w.name : sal.workerId}</td>
                      <td className="p-3 font-bold text-emerald-400">₹{sal.paidAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 uppercase text-[10px] font-mono text-slate-300">{sal.paymentMode || 'Cash'}</td>
                      <td className="p-3 text-slate-400">{sal.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. ADVANCES SECTION */}
      {activeTab === 'advances' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Labour Advances Ledger</h2>
              <p className="text-xs text-slate-400">Advance payments issued to workers across all projects.</p>
            </div>
            <div className="text-sm font-bold text-orange-400">
              Total Advances: ₹{totalAdvancesGiven.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Worker Name</th>
                  <th className="p-3">Advance Amount</th>
                  <th className="p-3">Reason / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {advances.slice(0, 50).map(adv => {
                  const s = siteMap.get(adv.siteId);
                  const w = workerMap.get(adv.workerId);
                  return (
                    <tr key={adv.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{adv.date}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3 font-semibold text-slate-100">{w ? w.name : adv.workerId}</td>
                      <td className="p-3 font-bold text-orange-400">₹{adv.amount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-slate-400">{adv.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. TOOLS SECTION */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Equipment & Tools Master Inventory</h2>
              <p className="text-xs text-slate-400">Track tools deployed across all construction sites.</p>
            </div>
            <div className="text-sm font-bold text-amber-400">
              {tools.length} Tools Tracked
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {tools.map(tool => {
              const s = siteMap.get(tool.siteId);
              return (
                <div key={tool.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-100 text-sm">{tool.toolName}</h4>
                    <span className="text-[10px] bg-slate-800 text-sky-300 px-2 py-0.5 rounded font-semibold">
                      Qty: {tool.quantity}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>Site: <strong className="text-slate-200">{s ? s.name : '—'}</strong></div>
                    <div>Type: <strong className="text-slate-300">{tool.type || 'Purchase'}</strong></div>
                    <div>Cost: <strong className="text-emerald-400">₹{(tool.cost || 0).toLocaleString('en-IN')}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. EXPENSES SECTION */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-400 font-semibold block">☕ Refreshments (Tea/Juice)</span>
                <span className="text-2xl font-black text-slate-100">
                  ₹{totalRefreshmentsSpend.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-3xl">☕</span>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-purple-400 font-semibold block">🪔 Pooja & Ceremonies</span>
                <span className="text-2xl font-black text-slate-100">
                  ₹{totalPoojaSpend.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-3xl">🪔</span>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-indigo-400 font-semibold block">📦 Other Miscellaneous</span>
                <span className="text-2xl font-black text-slate-100">
                  ₹{totalOtherSpend.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-3xl">📦</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Balance</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {teaExpenses.slice(0, 30).map(t => {
                  const s = siteMap.get(t.siteId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{t.date}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3">☕ Tea & Snacks</td>
                      <td className="p-3 font-bold text-slate-100">₹{t.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-emerald-400">₹{t.paidAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-rose-400">₹{t.balance.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-slate-400">{t.notes || '—'}</td>
                    </tr>
                  );
                })}
                {poojaExpenses.slice(0, 20).map(p => {
                  const s = siteMap.get(p.siteId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{p.date}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3">🪔 Pooja Expense</td>
                      <td className="p-3 font-bold text-slate-100">₹{p.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-emerald-400">₹{p.paidAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-rose-400">₹{p.balance.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-slate-400">{p.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. BILLS SECTION */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Utility Bills (Electricity & Water)</h2>
              <p className="text-xs text-slate-400">Consolidated cross-site utility bills ledger.</p>
            </div>
            <div className="text-sm font-bold text-sky-400">
              Total Utility Spend: ₹{totalBillsSpend.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Month / Date</th>
                  <th className="p-3">Site</th>
                  <th className="p-3">Utility Type</th>
                  <th className="p-3">Consumer / Account</th>
                  <th className="p-3">Bill Amount</th>
                  <th className="p-3">Paid Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {electricityBills.map(b => {
                  const s = siteMap.get(b.siteId);
                  const isPaid = b.paidAmount >= b.billAmount;
                  return (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{b.month}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3">⚡ Electricity</td>
                      <td className="p-3 font-mono">{b.meterNumber || '—'}</td>
                      <td className="p-3 font-bold text-slate-100">₹{b.billAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPaid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {waterBills.map(w => {
                  const s = siteMap.get(w.siteId);
                  const isPaid = w.paidAmount >= w.billAmount;
                  return (
                    <tr key={w.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{w.date}</td>
                      <td className="p-3 font-semibold text-amber-400">{s ? s.name : '—'}</td>
                      <td className="p-3">💧 Water Supply</td>
                      <td className="p-3">{w.supplier || 'Tanker'}</td>
                      <td className="p-3 font-bold text-slate-100">₹{w.billAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPaid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 11. COMMENTS SECTION */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Site Notes, Logs & Comments</h2>
              <p className="text-xs text-slate-400">Supervisor updates and site progress notes across all projects.</p>
            </div>
            <div className="text-xs text-slate-400">
              Total Notes: <strong className="text-slate-200">{siteComments.length}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {siteComments.map(c => {
              const s = siteMap.get(c.siteId);
              return (
                <div key={c.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2 shadow">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">{s ? s.name : 'Site'}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{new Date(c.dateTime).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-slate-200 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    {c.commentText}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 12. REPORTS SECTION */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
            <h2 className="text-base font-bold text-slate-100 mb-2">Cross-Site Executive Financial Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Materials Procurement</span>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  ₹{totalMaterialsSpend.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Labour Wages & Salaries</span>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  ₹{totalSalariesPaid.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Refreshments & Utility Bills</span>
                <div className="text-2xl font-black text-sky-400 mt-1">
                  ₹{(totalRefreshmentsSpend + totalBillsSpend).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <span className="text-xs text-slate-400 font-medium">Grand Project Spend</span>
                <div className="text-2xl font-black text-slate-100 mt-1">
                  ₹{totalAppGrandExpense.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-200">Site-by-Site Budget & Expense Breakdown</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Site Name</th>
                    <th className="p-3">Contractor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Budget</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sites.map(s => {
                    const contractorName = userMap.get(s.userId) || 'Head Mistry';
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-100">{s.name}</td>
                        <td className="p-3 text-slate-300">{contractorName}</td>
                        <td className="p-3 font-bold text-amber-400">{s.status}</td>
                        <td className="p-3 font-mono">
                          {(s as any).estimatedBudget ? `₹${(s as any).estimatedBudget.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => onSelectSite(s)}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all"
                          >
                            Open Dashboard
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 13. TRASH SECTION */}
      {activeTab === 'trash' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100">Global Recycle Bin & Data Recovery</h2>
              <p className="text-xs text-slate-400">
                Super Admin can inspect and restore deleted records across all mistries and construction sites.
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
                  <th className="p-3">Entity Type</th>
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
                        className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition-all"
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

      {/* 14. SECURITY AUDIT SECTION */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>Security Audit Trail & Activity Logs</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically tracked record of authentication events, password updates, admin actions, and database mutations.
              </p>
            </div>
            <div className="text-xs text-slate-400">
              Total Logged: <strong className="text-slate-200">{securityAuditLogs.length + activityLogs.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Actor / User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {securityAuditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-bold text-amber-400">{log.action}</td>
                    <td className="p-3 font-semibold text-slate-200">{log.actorName || 'System'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {log.actorRole || 'USER'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.result === 'SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{log.details}</td>
                  </tr>
                ))}
                {activityLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-bold text-indigo-400">{log.action}</td>
                    <td className="p-3 font-semibold text-slate-200">{log.userName || 'System'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {log.userRole || 'MISTRY'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        SUCCESS
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drilldown Modal: Inspect User Sites */}
      {inspectingUser && (
        <div className="modal-overlay" onClick={() => setInspectingUser(null)} role="dialog" aria-modal="true">
          <div className="modal-dialog max-w-2xl w-full" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header bg-slate-900 border-b border-slate-800 p-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <span>Construction Sites of {inspectingUser.fullName}</span>
                </h3>
                <p className="text-xs text-slate-400">@{inspectingUser.username} • {inspectingUser.mobile || inspectingUser.email}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setInspectingUser(null)} type="button">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const userSitesList = sites.filter(s => s.userId === inspectingUser.id);
                if (userSitesList.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400">
                      <Building2 className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                      <p>This contractor has not created any construction sites yet.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {userSitesList.map(s => (
                      <div
                        key={s.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow hover:border-amber-500/50 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-100 text-sm">{s.name}</h4>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                              {s.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                            <div>Type: <strong className="text-slate-200">{s.buildingType}</strong> • Area: <strong className="text-slate-200">{s.area || s.address || '—'}</strong></div>
                            <div>Owner: <strong className="text-slate-200">{s.ownerName} ({s.ownerPhone || '—'})</strong></div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setInspectingUser(null);
                            onSelectSite(s);
                          }}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Select Site (Open Dashboard)</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                onClick={() => setInspectingUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Assist Modal */}
      {resetModalUser && (
        <div className="modal-overlay" onClick={() => setResetModalUser(null)} role="dialog" aria-modal="true">
          <div className="modal-dialog max-w-md w-full" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border-b border-indigo-500/30 p-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <span>Password Reset Assist (கடவுச்சொல் மீட்டமைப்பு)</span>
              </h3>
              <button className="modal-close-btn" onClick={() => setResetModalUser(null)} type="button">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecutePasswordResetAssist}>
              <div className="modal-body p-5 space-y-4">
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-300">
                  Assisting password reset for contractor <strong>{resetModalUser.fullName}</strong> (@{resetModalUser.username}). Setting a temporary password will require them to choose their own private password upon their next login.
                </div>

                {resetError && (
                  <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{resetError}</span>
                  </div>
                )}

                {resetSuccessMessage ? (
                  <div className="space-y-3">
                    <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl text-xs">
                      {resetSuccessMessage}
                    </div>

                    <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-semibold">Temporary Password:</span>
                        <code className="text-base font-mono font-bold text-amber-400">{tempPassword}</code>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedPassword ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>New Temporary Password (min 8 chars):</span>
                        <button
                          type="button"
                          onClick={() => setTempPassword(`Mistry@${Math.floor(1000 + Math.random() * 9000)}`)}
                          className="text-[11px] text-amber-400 hover:underline font-semibold"
                        >
                          Generate New
                        </button>
                      </label>
                      <input
                        type="text"
                        required
                        minLength={8}
                        value={tempPassword}
                        onChange={e => setTempPassword(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Requirement: Must be at least 8 characters long and contain both letters and numbers.
                    </p>
                  </div>
                )}
              </div>

              <div className="modal-footer p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  {resetSuccessMessage ? 'Done' : 'Cancel'}
                </button>
                {!resetSuccessMessage && (
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{isResettingPassword ? 'Resetting...' : 'Confirm Reset Password'}</span>
                  </button>
                )}
              </div>
            </form>
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
