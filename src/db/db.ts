import Dexie, { type Table } from 'dexie';
import type {
  Site,
  Material,
  RodEntry,
  LabourWorker,
  AttendanceRecord,
  LabourAdvance,
  SalaryPayment,
  ToolItem,
  TeaSnacksExpense,
  PoojaExpense,
  ElectricityBill,
  WaterBill,
  SiteComment,
  OtherExpense,
  User,
  ActivityLog,
  MaterialPriceQuote,
  BuildingEstimate,
  EntityTable,
  TrashRecord,
  PaymentTransaction,
  OtpSession,
  AdminAuditLog,
  UserRole,
  FloorPlan,
} from './types';

export class BuildingMistryDB extends Dexie {
  sites!: Table<Site, string>;
  materials!: Table<Material, string>;
  rodEntries!: Table<RodEntry, string>;
  workers!: Table<LabourWorker, string>;
  attendance!: Table<AttendanceRecord, string>;
  labourAdvances!: Table<LabourAdvance, string>;
  salaryPayments!: Table<SalaryPayment, string>;
  tools!: Table<ToolItem, string>;
  teaSnacksExpenses!: Table<TeaSnacksExpense, string>;
  poojaExpenses!: Table<PoojaExpense, string>;
  electricityBills!: Table<ElectricityBill, string>;
  waterBills!: Table<WaterBill, string>;
  siteComments!: Table<SiteComment, string>;
  otherExpenses!: Table<OtherExpense, string>;
  users!: Table<User, string>;
  activityLogs!: Table<ActivityLog, string>;
  materialPrices!: Table<MaterialPriceQuote, string>;
  estimates!: Table<BuildingEstimate, string>;
  payments!: Table<PaymentTransaction, string>;
  otpSessions!: Table<OtpSession, string>;
  adminAuditLogs!: Table<AdminAuditLog, string>;
  floorPlans!: Table<FloorPlan, string>;

  constructor() {
    super('BuildingMistryDB');

    this.version(1).stores({
      sites: 'id, name, status, isDeleted, createdAt',
      materials: 'id, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, siteId, category, isDeleted, name',
      attendance: 'id, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, siteId, workerId, date, isDeleted',
      tools: 'id, siteId, isDeleted',
      teaSnacksExpenses: 'id, siteId, date, isDeleted',
      poojaExpenses: 'id, siteId, date, isDeleted',
      electricityBills: 'id, siteId, month, isDeleted',
      waterBills: 'id, siteId, date, isDeleted',
      siteComments: 'id, siteId, dateTime, isDeleted',
    });

    this.version(2).stores({
      sites: 'id, name, status, isDeleted, createdAt',
      materials: 'id, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, siteId, category, isDeleted, name',
      attendance: 'id, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, siteId, workerId, date, isDeleted',
      tools: 'id, siteId, isDeleted',
      teaSnacksExpenses: 'id, siteId, date, isDeleted',
      poojaExpenses: 'id, siteId, date, isDeleted',
      electricityBills: 'id, siteId, month, isDeleted',
      waterBills: 'id, siteId, date, isDeleted',
      siteComments: 'id, siteId, dateTime, isDeleted',
      otherExpenses: 'id, siteId, category, isDeleted, date',
      users: 'id, username, mobile, email',
      activityLogs: 'id, siteId, timestamp',
    });

    this.version(3).stores({
      sites: 'id, name, status, isDeleted, createdAt',
      materials: 'id, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, siteId, category, isDeleted, name',
      attendance: 'id, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, siteId, workerId, date, isDeleted',
      tools: 'id, siteId, isDeleted',
      teaSnacksExpenses: 'id, siteId, date, isDeleted',
      poojaExpenses: 'id, siteId, date, isDeleted',
      electricityBills: 'id, siteId, month, isDeleted',
      waterBills: 'id, siteId, date, isDeleted',
      siteComments: 'id, siteId, dateTime, isDeleted',
      otherExpenses: 'id, siteId, category, isDeleted, date',
      users: 'id, username, mobile, email',
      activityLogs: 'id, siteId, timestamp',
      materialPrices: 'id, material, supplier, district, effectiveDate, isDeleted',
      estimates: 'id, siteId, estimateName, isDeleted, createdAt',
    });

    this.version(4).stores({
      sites: 'id, userId, name, status, isDeleted, createdAt',
      materials: 'id, userId, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, userId, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, userId, siteId, category, isDeleted, name',
      attendance: 'id, userId, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, userId, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, userId, siteId, workerId, date, isDeleted',
      tools: 'id, userId, siteId, isDeleted',
      teaSnacksExpenses: 'id, userId, siteId, date, isDeleted',
      poojaExpenses: 'id, userId, siteId, date, isDeleted',
      electricityBills: 'id, userId, siteId, month, isDeleted',
      waterBills: 'id, userId, siteId, date, isDeleted',
      siteComments: 'id, userId, siteId, dateTime, isDeleted',
      otherExpenses: 'id, userId, siteId, category, isDeleted, date',
      users: 'id, username, mobile, email, role, isActive',
      activityLogs: 'id, userId, siteId, timestamp',
      materialPrices: 'id, userId, material, supplier, district, effectiveDate, isDeleted',
      estimates: 'id, userId, siteId, estimateName, isDeleted, createdAt',
    });

    this.version(5).stores({
      sites: 'id, userId, name, status, isDeleted, createdAt',
      materials: 'id, userId, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, userId, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, userId, siteId, category, isDeleted, name',
      attendance: 'id, userId, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, userId, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, userId, siteId, workerId, date, isDeleted',
      tools: 'id, userId, siteId, isDeleted',
      teaSnacksExpenses: 'id, userId, siteId, date, isDeleted',
      poojaExpenses: 'id, userId, siteId, date, isDeleted',
      electricityBills: 'id, userId, siteId, month, isDeleted',
      waterBills: 'id, userId, siteId, date, isDeleted',
      siteComments: 'id, userId, siteId, dateTime, isDeleted',
      otherExpenses: 'id, userId, siteId, category, isDeleted, date',
      users: 'id, username, mobile, email, role, isActive',
      activityLogs: 'id, userId, siteId, timestamp',
      materialPrices: 'id, userId, material, supplier, district, effectiveDate, isDeleted',
      estimates: 'id, userId, siteId, estimateName, isDeleted, createdAt',
      payments: 'id, userId, siteId, relatedRecordId, module, date, isDeleted, [siteId+date]',
    });

    this.version(6).stores({
      sites: 'id, userId, name, status, isDeleted, createdAt',
      materials: 'id, userId, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, userId, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, userId, siteId, category, isDeleted, name',
      attendance: 'id, userId, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, userId, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, userId, siteId, workerId, date, isDeleted',
      tools: 'id, userId, siteId, isDeleted',
      teaSnacksExpenses: 'id, userId, siteId, date, isDeleted',
      poojaExpenses: 'id, userId, siteId, date, isDeleted',
      electricityBills: 'id, userId, siteId, month, isDeleted',
      waterBills: 'id, userId, siteId, date, isDeleted',
      siteComments: 'id, userId, siteId, dateTime, isDeleted',
      otherExpenses: 'id, userId, siteId, category, isDeleted, date',
      users: 'id, username, mobile, phoneNormalized, email, role, isActive',
      activityLogs: 'id, userId, siteId, timestamp',
      materialPrices: 'id, userId, material, supplier, district, effectiveDate, isDeleted',
      estimates: 'id, userId, siteId, estimateName, isDeleted, createdAt',
      payments: 'id, userId, siteId, relatedRecordId, module, date, isDeleted, [siteId+date]',
      otpSessions: 'id, phoneNormalized, token, expiresAt',
      adminAuditLogs: 'id, action, actorId, timestamp',
    });

    // Version 7: Add Floor Plan Creator table (additive — no existing data affected)
    this.version(7).stores({
      sites: 'id, userId, name, status, isDeleted, createdAt',
      materials: 'id, userId, siteId, category, isDeleted, purchaseDate',
      rodEntries: 'id, userId, siteId, diameter, isDeleted, purchaseDate',
      workers: 'id, userId, siteId, category, isDeleted, name',
      attendance: 'id, userId, siteId, workerId, date, isDeleted, [siteId+date]',
      labourAdvances: 'id, userId, siteId, workerId, date, isDeleted',
      salaryPayments: 'id, userId, siteId, workerId, date, isDeleted',
      tools: 'id, userId, siteId, isDeleted',
      teaSnacksExpenses: 'id, userId, siteId, date, isDeleted',
      poojaExpenses: 'id, userId, siteId, date, isDeleted',
      electricityBills: 'id, userId, siteId, month, isDeleted',
      waterBills: 'id, userId, siteId, date, isDeleted',
      siteComments: 'id, userId, siteId, dateTime, isDeleted',
      otherExpenses: 'id, userId, siteId, category, isDeleted, date',
      users: 'id, username, mobile, phoneNormalized, email, role, isActive',
      activityLogs: 'id, userId, siteId, timestamp',
      materialPrices: 'id, userId, material, supplier, district, effectiveDate, isDeleted',
      estimates: 'id, userId, siteId, estimateName, isDeleted, createdAt',
      payments: 'id, userId, siteId, relatedRecordId, module, date, isDeleted, [siteId+date]',
      otpSessions: 'id, phoneNormalized, token, expiresAt',
      adminAuditLogs: 'id, action, actorId, timestamp',
      floorPlans: 'id, userId, siteId, isDeleted, createdAt',
    });
  }

  // Soft Delete
  async softDelete(tableName: EntityTable, id: string): Promise<void> {
    const table = this.table(tableName);
    const now = new Date().toISOString();
    await table.update(id, {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    });
  }

  // Restore Record
  async restoreRecord(tableName: EntityTable, id: string): Promise<void> {
    const table = this.table(tableName);
    const now = new Date().toISOString();
    await table.update(id, {
      isDeleted: false,
      deletedAt: undefined,
      updatedAt: now,
    });
  }

  // Permanent Delete
  async permanentDelete(tableName: EntityTable, id: string): Promise<void> {
    const table = this.table(tableName);
    await table.delete(id);
  }

  // Log Activity Helper with full backward compatibility and user audit logging
  async logActivity(
    firstParam?: any,
    secondParam?: any,
    thirdParam?: any,
    fourthParam?: any,
    fifthParam?: any,
    sixthParam?: any,
    seventhParam?: any
  ): Promise<void> {
    let userId: string | undefined;
    let userName: string | undefined;
    let userRole: any | undefined;
    let siteId: string | undefined;
    let siteName: string | undefined;
    let action: string = 'UPDATE';
    let description: string = '';

    if (seventhParam !== undefined) {
      userId = firstParam;
      userName = secondParam;
      userRole = thirdParam;
      siteId = fourthParam;
      siteName = fifthParam;
      action = sixthParam || 'UPDATE';
      description = seventhParam || '';
    } else if (thirdParam !== undefined) {
      siteId = firstParam;
      action = secondParam || 'UPDATE';
      description = thirdParam || '';
    } else if (secondParam !== undefined) {
      action = firstParam || 'UPDATE';
      description = secondParam || '';
    } else if (firstParam !== undefined) {
      description = firstParam;
    }

    try {
      const logEntry: ActivityLog = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        userName,
        userRole,
        siteId,
        siteName,
        action,
        description,
        timestamp: new Date().toISOString(),
      };
      await this.activityLogs.put(logEntry);
    } catch {
      // Non-blocking in case of storage issues
    }
  }

  // Log Security & Admin Audit (Never stores passwords or OTPs)
  async logSecurityAudit(
    action: string,
    actor: { id: string; fullName?: string; username?: string; role: UserRole },
    affectedRecordId?: string,
    affectedTable?: string,
    result: 'SUCCESS' | 'FAILURE' | 'DENIED' = 'SUCCESS',
    details?: string
  ): Promise<void> {
    try {
      const auditEntry: AdminAuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        action,
        actorId: actor.id,
        actorName: actor.fullName || actor.username || 'System',
        actorRole: actor.role,
        affectedRecordId,
        affectedTable,
        result,
        details,
        timestamp: new Date().toISOString(),
      };
      await this.adminAuditLogs.put(auditEntry);
    } catch {
      // Non-blocking
    }
  }

  async logAdminAudit(
    adminUser: User,
    action: string,
    details?: string,
    siteId?: string,
    siteName?: string
  ): Promise<void> {
    await this.logActivity(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      siteId,
      siteName,
      action,
      details || `Admin action performed: ${action}`
    );
  }

  async getAllAdminAuditLogs(user: User): Promise<AdminAuditLog[]> {
    const isElevated =
      user.role === 'SUPER_ADMIN' ||
      user.role === 'SUB_ADMIN' ||
      user.role === 'ADMIN';
    if (!isElevated) {
      throw new Error('Access Denied: Only administrators can view security audit logs.');
    }
    return this.adminAuditLogs.reverse().sortBy('timestamp');
  }

  // User Data Access & Authorization Helpers (Database Row Level Security)
  async getSitesForUser(user: User): Promise<Site[]> {
    const initialAdminEmail = ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_EMAIL) || 'tamilthilagan82@gmail.com').toLowerCase();
    const isElevated =
      user.role === 'ADMIN' ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'SUB_ADMIN' ||
      (user.email || '').toLowerCase() === initialAdminEmail;

    if (isElevated) {
      return this.sites.filter(s => !s.isDeleted).reverse().sortBy('createdAt');
    }
    return this.sites
      .filter(s => !s.isDeleted && s.userId === user.id)
      .reverse()
      .sortBy('createdAt');
  }

  async getSiteForUser(user: User, siteId: string): Promise<Site | null> {
    const site = await this.sites.get(siteId);
    if (!site || site.isDeleted) return null;
    const initialAdminEmail = ((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_EMAIL) || 'tamilthilagan82@gmail.com').toLowerCase();
    const isElevated =
      user.role === 'ADMIN' ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'SUB_ADMIN' ||
      (user.email || '').toLowerCase() === initialAdminEmail;

    if (!isElevated && site.userId && site.userId !== user.id) {
      throw new Error("Access Denied: You do not have permission to view another contractor's site.");
    }
    return site;
  }

  async softDeleteForUser(user: User, tableName: EntityTable, id: string): Promise<void> {
    const table = this.table(tableName);
    const record: any = await table.get(id);
    if (!record) return;
    const isMistry = user.role === 'MISTRY' || user.role === 'MISTRY_USER';
    if (isMistry && record.userId && record.userId !== user.id) {
      throw new Error("Access Denied: You cannot delete another contractor's record.");
    }
    const now = new Date().toISOString();
    await table.update(id, {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    });
    await this.logActivity(
      user.id,
      user.fullName || user.username,
      user.role,
      record.siteId,
      undefined,
      'SOFT_DELETE',
      `Moved ${tableName} record to Recycle Bin`
    );
    await this.logSecurityAudit(
      'RECORD_SOFT_DELETED',
      user,
      id,
      tableName,
      'SUCCESS',
      `Moved ${tableName} record (${id}) to Trash`
    );
  }

  async restoreRecordForUser(user: User, tableName: EntityTable, id: string): Promise<void> {
    const table = this.table(tableName);
    const record: any = await table.get(id);
    if (!record) return;
    const isMistry = user.role === 'MISTRY' || user.role === 'MISTRY_USER';
    if (isMistry && record.userId && record.userId !== user.id) {
      throw new Error("Access Denied: You cannot restore another contractor's record.");
    }
    const now = new Date().toISOString();
    await table.update(id, {
      isDeleted: false,
      deletedAt: undefined,
      updatedAt: now,
    });
    await this.logActivity(
      user.id,
      user.fullName || user.username,
      user.role,
      record.siteId,
      undefined,
      'RESTORE',
      `Restored ${tableName} record from Recycle Bin`
    );
    await this.logSecurityAudit(
      'RECORD_RESTORED',
      user,
      id,
      tableName,
      'SUCCESS',
      `Restored ${tableName} record (${id}) from Trash`
    );
  }

  async permanentDeleteForUser(user: User, tableName: EntityTable, id: string): Promise<void> {
    const table = this.table(tableName);
    const record: any = await table.get(id);
    if (!record) return;
    const isMistry = user.role === 'MISTRY' || user.role === 'MISTRY_USER';
    if (isMistry && record.userId && record.userId !== user.id) {
      throw new Error("Access Denied: You cannot permanently delete another contractor's record.");
    }
    await table.delete(id);
    await this.logActivity(
      user.id,
      user.fullName || user.username,
      user.role,
      record.siteId,
      undefined,
      'PERMANENT_DELETE',
      `Permanently deleted ${tableName} record (${id})`
    );
    await this.logSecurityAudit(
      'RECORD_PERMANENTLY_DELETED',
      user,
      id,
      tableName,
      'SUCCESS',
      `Permanently deleted ${tableName} record (${id})`
    );
  }

  // Fetch all trash items with user scoping
  async getAllTrash(user?: User): Promise<TrashRecord[]> {
    const trashItems: TrashRecord[] = [];
    const allSites = await this.sites.toArray();
    const siteMap = new Map(allSites.map(s => [s.id, s.name]));
    const allUsers = await this.users.toArray();
    const userMap = new Map(allUsers.map(u => [u.id, u.fullName || u.username]));

    // 1. Sites
    const deletedSites = allSites.filter(s => s.isDeleted);
    deletedSites.forEach(s => {
      trashItems.push({
        id: s.id,
        tableName: 'sites',
        entityType: 'Site',
        title: s.name,
        subtitle: `Owner: ${s.ownerName} | Location: ${s.area || s.address}`,
        amount: undefined,
        deletedAt: s.deletedAt || s.updatedAt,
        rawData: s,
      });
    });

    // 2. Materials
    const deletedMaterials = await this.materials.filter(m => m.isDeleted).toArray();
    deletedMaterials.forEach(m => {
      trashItems.push({
        id: m.id,
        tableName: 'materials',
        entityType: `Material (${m.category.toUpperCase()})`,
        title: m.materialName || `${m.category.toUpperCase()} - ${m.supplier}`,
        subtitle: `Site: ${siteMap.get(m.siteId) || 'Unknown Site'} | Qty: ${m.quantity} ${m.unit}`,
        siteId: m.siteId,
        siteName: siteMap.get(m.siteId),
        amount: m.totalAmount,
        deletedAt: m.deletedAt || m.updatedAt,
        rawData: m,
      });
    });

    // 3. Rod entries
    const deletedRods = await this.rodEntries.filter(r => r.isDeleted).toArray();
    deletedRods.forEach(r => {
      trashItems.push({
        id: r.id,
        tableName: 'rodEntries',
        entityType: 'Rod / Steel',
        title: `Rod ${r.diameter} - ${r.weightKg} kg`,
        subtitle: `Site: ${siteMap.get(r.siteId) || 'Unknown'} | Supplier: ${r.supplier}`,
        siteId: r.siteId,
        siteName: siteMap.get(r.siteId),
        amount: r.totalAmount,
        deletedAt: r.deletedAt || r.updatedAt,
        rawData: r,
      });
    });

    // 4. Workers
    const deletedWorkers = await this.workers.filter(w => w.isDeleted).toArray();
    deletedWorkers.forEach(w => {
      trashItems.push({
        id: w.id,
        tableName: 'workers',
        entityType: 'Worker',
        title: w.name,
        subtitle: `Category: ${w.category} | Wage: ₹${w.dailyWage}/day`,
        siteId: w.siteId,
        siteName: siteMap.get(w.siteId),
        deletedAt: w.deletedAt || w.updatedAt,
        rawData: w,
      });
    });

    // 5. Attendance
    const deletedAttendance = await this.attendance.filter(a => a.isDeleted).toArray();
    deletedAttendance.forEach(a => {
      trashItems.push({
        id: a.id,
        tableName: 'attendance',
        entityType: 'Attendance',
        title: `Attendance: ${a.date} (${a.status.toUpperCase()})`,
        subtitle: `Site: ${siteMap.get(a.siteId) || 'Unknown'}`,
        siteId: a.siteId,
        siteName: siteMap.get(a.siteId),
        deletedAt: a.deletedAt || a.updatedAt,
        rawData: a,
      });
    });

    // 6. Labour Advances
    const deletedAdvances = await this.labourAdvances.filter(a => a.isDeleted).toArray();
    deletedAdvances.forEach(a => {
      trashItems.push({
        id: a.id,
        tableName: 'labourAdvances',
        entityType: 'Labour Advance',
        title: `Advance ₹${a.amount}`,
        subtitle: `Date: ${a.date} ${a.reason ? '| ' + a.reason : ''}`,
        siteId: a.siteId,
        siteName: siteMap.get(a.siteId),
        amount: a.amount,
        deletedAt: a.deletedAt || a.updatedAt,
        rawData: a,
      });
    });

    // 7. Salary Payments
    const deletedSalaries = await this.salaryPayments.filter(s => s.isDeleted).toArray();
    deletedSalaries.forEach(s => {
      trashItems.push({
        id: s.id,
        tableName: 'salaryPayments',
        entityType: 'Salary Payment',
        title: `Salary Paid ₹${s.paidAmount}`,
        subtitle: `Date: ${s.date} | Days: ${s.daysWorked}`,
        siteId: s.siteId,
        siteName: siteMap.get(s.siteId),
        amount: s.paidAmount,
        deletedAt: s.deletedAt || s.updatedAt,
        rawData: s,
      });
    });

    // 8. Tools
    const deletedTools = await this.tools.filter(t => t.isDeleted).toArray();
    deletedTools.forEach(t => {
      trashItems.push({
        id: t.id,
        tableName: 'tools',
        entityType: 'Tool',
        title: `${t.toolName} (Qty: ${t.quantity})`,
        subtitle: `${t.type} | Site: ${siteMap.get(t.siteId) || 'Unknown'}`,
        siteId: t.siteId,
        siteName: siteMap.get(t.siteId),
        amount: t.cost,
        deletedAt: t.deletedAt || t.updatedAt,
        rawData: t,
      });
    });

    // 9. Tea & Snacks
    const deletedTeaSnacks = await this.teaSnacksExpenses.filter(t => t.isDeleted).toArray();
    deletedTeaSnacks.forEach(t => {
      trashItems.push({
        id: t.id,
        tableName: 'teaSnacksExpenses',
        entityType: 'Tea & Snacks',
        title: `Tea & Snacks: ₹${t.totalAmount}`,
        subtitle: `Date: ${t.date} | Tea: ₹${t.teaExpense} Snacks: ₹${t.snacksExpense}`,
        siteId: t.siteId,
        siteName: siteMap.get(t.siteId),
        amount: t.totalAmount,
        deletedAt: t.deletedAt || t.updatedAt,
        rawData: t,
      });
    });

    // 10. Pooja Expenses
    const deletedPooja = await this.poojaExpenses.filter(p => p.isDeleted).toArray();
    deletedPooja.forEach(p => {
      trashItems.push({
        id: p.id,
        tableName: 'poojaExpenses',
        entityType: 'Pooja Expense',
        title: `${p.poojaName}: ₹${p.totalAmount}`,
        subtitle: `Date: ${p.date} | Site: ${siteMap.get(p.siteId) || 'Unknown'}`,
        siteId: p.siteId,
        siteName: siteMap.get(p.siteId),
        amount: p.totalAmount,
        deletedAt: p.deletedAt || p.updatedAt,
        rawData: p,
      });
    });

    // 11. Electricity Bills
    const deletedElectricity = await this.electricityBills.filter(e => e.isDeleted).toArray();
    deletedElectricity.forEach(e => {
      trashItems.push({
        id: e.id,
        tableName: 'electricityBills',
        entityType: 'Electricity Bill',
        title: `Electricity: ₹${e.billAmount} (${e.month})`,
        subtitle: `Site: ${siteMap.get(e.siteId) || 'Unknown'}`,
        siteId: e.siteId,
        siteName: siteMap.get(e.siteId),
        amount: e.billAmount,
        deletedAt: e.deletedAt || e.updatedAt,
        rawData: e,
      });
    });

    // 12. Water Bills
    const deletedWater = await this.waterBills.filter(w => w.isDeleted).toArray();
    deletedWater.forEach(w => {
      trashItems.push({
        id: w.id,
        tableName: 'waterBills',
        entityType: 'Water Bill',
        title: `Water: ₹${w.billAmount} (${w.supplier})`,
        subtitle: `Date: ${w.date} | Loads: ${w.quantityLoads || 'N/A'}`,
        siteId: w.siteId,
        siteName: siteMap.get(w.siteId),
        amount: w.billAmount,
        deletedAt: w.deletedAt || w.updatedAt,
        rawData: w,
      });
    });

    // 13. Comments
    const deletedComments = await this.siteComments.filter(c => c.isDeleted).toArray();
    deletedComments.forEach(c => {
      trashItems.push({
        id: c.id,
        tableName: 'siteComments',
        entityType: 'Site Note',
        title: `[${c.category}] ${c.commentText.slice(0, 40)}...`,
        subtitle: `Date: ${new Date(c.dateTime).toLocaleDateString()} | Site: ${siteMap.get(c.siteId) || 'Unknown'}`,
        siteId: c.siteId,
        siteName: siteMap.get(c.siteId),
        deletedAt: c.deletedAt || c.updatedAt,
        rawData: c,
      });
    });

    // 14. Other Expenses
    const deletedOtherExpenses = await this.otherExpenses.filter(o => o.isDeleted).toArray();
    deletedOtherExpenses.forEach(o => {
      trashItems.push({
        id: o.id,
        tableName: 'otherExpenses',
        entityType: `Other (${o.category})`,
        title: `${o.category}: ${o.description.slice(0, 35)}...`,
        subtitle: `Date: ${o.date} | Site: ${siteMap.get(o.siteId) || 'Unknown'}`,
        siteId: o.siteId,
        siteName: siteMap.get(o.siteId),
        amount: o.amount,
        deletedAt: o.deletedAt || o.updatedAt,
        rawData: o,
      });
    });

    // 15. Material Supplier Quotes
    const deletedPrices = await this.materialPrices.filter(p => p.isDeleted).toArray();
    deletedPrices.forEach(p => {
      trashItems.push({
        id: p.id,
        tableName: 'materialPrices',
        entityType: 'Supplier Quote',
        title: `${p.material} - ${p.brand || p.product} (₹${p.price}/${p.unit})`,
        subtitle: `Supplier: ${p.supplier} | District: ${p.district}`,
        amount: p.price,
        deletedAt: p.deletedAt || p.updatedAt,
        rawData: p,
      });
    });

    // 16. Building Estimates
    const deletedEstimates = await this.estimates.filter(e => e.isDeleted).toArray();
    deletedEstimates.forEach(e => {
      trashItems.push({
        id: e.id,
        tableName: 'estimates',
        entityType: 'Building Estimate',
        title: e.estimateName,
        subtitle: `Area: ${e.convertedBuiltUpSqFt} sq.ft (${e.floors} floors) | Cost: ₹${e.totalEstimatedCost.toLocaleString('en-IN')}`,
        siteId: e.siteId,
        siteName: e.siteName,
        amount: e.totalEstimatedCost,
        deletedAt: e.deletedAt || e.updatedAt,
        rawData: e,
      });
    });

    // 17. Payment Transactions
    const deletedPayments = await this.payments.filter(p => p.isDeleted).toArray();
    deletedPayments.forEach(p => {
      trashItems.push({
        id: p.id,
        tableName: 'payments',
        entityType: 'Payment Transaction',
        title: `Payment ${p.id}: ₹${p.amount} (${p.paymentType})`,
        subtitle: `Date: ${p.date} | Site: ${siteMap.get(p.siteId) || 'Unknown'}`,
        siteId: p.siteId,
        siteName: siteMap.get(p.siteId),
        amount: p.amount,
        deletedAt: p.deletedAt || p.updatedAt,
        rawData: p,
      });
    });

    // If user is MISTRY, filter by user ownership
    if (user && user.role === 'MISTRY') {
      const userSiteIds = new Set(allSites.filter(s => s.userId === user.id).map(s => s.id));
      const filtered = trashItems.filter(
        t => t.rawData?.userId === user.id || (t.siteId && userSiteIds.has(t.siteId))
      );
      return filtered.sort(
        (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      );
    }

    // Sort newest deleted first
    return trashItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }

  // Seed default market reference supplier prices if empty
  async seedDefaultMaterialPrices(): Promise<number> {
    const existingCount = await this.materialPrices.count();
    if (existingCount > 0) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const quotes: MaterialPriceQuote[] = [
      // Cement
      {
        id: 'price-cem-1',
        material: 'Cement',
        brand: 'UltraTech',
        product: 'UltraTech Super PPC 50kg',
        grade: 'PPC',
        unit: 'Bag',
        price: 420,
        supplier: 'Sri Murugan Blue Metal & Cements',
        district: 'Coimbatore',
        area: 'Saravanampatti',
        effectiveDate: today,
        updatedAt: today,
        source: 'Market Reference',
        isDeleted: false,
      },
      {
        id: 'price-cem-2',
        material: 'Cement',
        brand: 'Ramco',
        product: 'Ramco Supercrete PPC 50kg',
        grade: 'PPC',
        unit: 'Bag',
        price: 430,
        supplier: 'Annai Hardware & Steel',
        district: 'Coimbatore',
        area: 'Gandhipuram',
        effectiveDate: today,
        updatedAt: today,
        source: 'Market Reference',
        isDeleted: false,
      },
      {
        id: 'price-cem-3',
        material: 'Cement',
        brand: 'Dalmia',
        product: 'Dalmia DSP Cement 50kg',
        grade: 'DSP',
        unit: 'Bag',
        price: 410,
        supplier: 'Vasantham Building Materials',
        district: 'Coimbatore',
        area: 'Singanallur',
        effectiveDate: today,
        updatedAt: today,
        source: 'Market Reference',
        isDeleted: false,
      },

      // Sand / M-Sand
      {
        id: 'price-sand-1',
        material: 'Sand',
        brand: 'Cauvery River Sand',
        product: 'Screened River Sand (Plastering)',
        unit: 'CFT',
        price: 135,
        supplier: 'Kaveri Natural Sands',
        district: 'Trichy',
        area: 'Musiri',
        effectiveDate: today,
        updatedAt: today,
        source: 'Govt Depot Rate',
        isDeleted: false,
      },
      {
        id: 'price-msand-1',
        material: 'M-Sand',
        brand: 'VSI Crushed',
        product: 'Manufactured Sand (Zone II Concrete)',
        unit: 'CFT',
        price: 45,
        supplier: 'Kongu Blue Metals & Quarry',
        district: 'Coimbatore',
        area: 'Madukkarai',
        effectiveDate: today,
        updatedAt: today,
        source: 'Quarry Direct',
        isDeleted: false,
      },
      {
        id: 'price-msand-2',
        material: 'M-Sand',
        brand: 'P-Sand (Plastering)',
        product: 'Plastering Sand (Air Classified)',
        unit: 'CFT',
        price: 52,
        supplier: 'Kongu Blue Metals & Quarry',
        district: 'Coimbatore',
        area: 'Madukkarai',
        effectiveDate: today,
        updatedAt: today,
        source: 'Quarry Direct',
        isDeleted: false,
      },

      // Aggregate
      {
        id: 'price-agg-1',
        material: 'Aggregate',
        brand: 'Blue Metal Granite',
        product: '20mm Graded Coarse Aggregate',
        unit: 'CFT',
        price: 42,
        supplier: 'Kongu Blue Metals & Quarry',
        district: 'Coimbatore',
        area: 'Madukkarai',
        effectiveDate: today,
        updatedAt: today,
        source: 'Quarry Direct',
        isDeleted: false,
      },
      {
        id: 'price-agg-2',
        material: 'Aggregate',
        brand: 'Blue Metal Granite',
        product: '12mm & 40mm Graded Aggregate',
        unit: 'CFT',
        price: 40,
        supplier: 'Selvam Stone Crusher',
        district: 'Tiruppur',
        area: 'Palladam',
        effectiveDate: today,
        updatedAt: today,
        source: 'Crusher Rate',
        isDeleted: false,
      },

      // Bricks
      {
        id: 'price-brick-1',
        material: 'Bricks',
        brand: 'Wire Cut Red',
        product: 'Standard Chamber Red Clay Bricks (9x4x3)',
        unit: 'Piece',
        price: 10.50,
        supplier: 'Thangam Brick Works',
        district: 'Coimbatore',
        area: 'Thondamuthur',
        effectiveDate: today,
        updatedAt: today,
        source: 'Kiln Direct',
        isDeleted: false,
      },
      {
        id: 'price-brick-2',
        material: 'Bricks',
        brand: 'AAC Light Weight',
        product: 'Autoclaved Aerated Concrete Blocks (9x8x4)',
        unit: 'Piece',
        price: 58.00,
        supplier: 'GreenBuild AAC Blocks',
        district: 'Coimbatore',
        area: 'Sulur',
        effectiveDate: today,
        updatedAt: today,
        source: 'Factory Direct',
        isDeleted: false,
      },

      // Steel
      {
        id: 'price-stl-1',
        material: 'Steel',
        brand: 'Tata Tiscon',
        product: 'Tata Tiscon 550D TMT Rebars',
        grade: 'Fe550',
        unit: 'Kg',
        price: 76.00,
        supplier: 'Annai Hardware & Steel',
        district: 'Coimbatore',
        area: 'Gandhipuram',
        effectiveDate: today,
        updatedAt: today,
        source: 'Authorised Dealer',
        isDeleted: false,
      },
      {
        id: 'price-stl-2',
        material: 'Steel',
        brand: 'JSW Neosteel',
        product: 'JSW Neosteel Fe 550D Super Ductile',
        grade: 'Fe550',
        unit: 'Kg',
        price: 72.50,
        supplier: 'Sri Murugan Blue Metal & Cements',
        district: 'Coimbatore',
        area: 'Saravanampatti',
        effectiveDate: today,
        updatedAt: today,
        source: 'Distributor Rate',
        isDeleted: false,
      },
      {
        id: 'price-stl-3',
        material: 'Steel',
        brand: 'Kamachi TMT',
        product: 'Kamachi 500D Premium TMT Rebars',
        grade: 'Fe500',
        unit: 'Kg',
        price: 68.00,
        supplier: 'Vasantham Building Materials',
        district: 'Coimbatore',
        area: 'Singanallur',
        effectiveDate: today,
        updatedAt: today,
        source: 'Wholesale Depot',
        isDeleted: false,
      },
    ];

    await this.materialPrices.bulkAdd(quotes);
    return quotes.length;
  }

  // Clear all Demo data
  async clearDemoData(): Promise<number> {
    const tables: Table<any, string>[] = [
      this.sites,
      this.materials,
      this.rodEntries,
      this.workers,
      this.attendance,
      this.labourAdvances,
      this.salaryPayments,
      this.tools,
      this.teaSnacksExpenses,
      this.poojaExpenses,
      this.electricityBills,
      this.waterBills,
      this.siteComments,
      this.otherExpenses,
      this.estimates,
      this.payments,
    ];

    let count = 0;
    for (const table of tables) {
      const demoRecords = await table.filter(item => item.isDemo === true).toArray();
      count += demoRecords.length;
      for (const record of demoRecords) {
        await table.delete(record.id);
      }
    }
    return count;
  }
}

export const db = new BuildingMistryDB();
