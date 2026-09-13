export type SiteStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed';

export interface SiteFinancialSummary {
  materialCost: number;
  materialPaid: number;
  materialBalance: number;
  materialExtraPaid: number;

  labourGrossSalary: number;
  labourPaid: number;
  labourAdvances: number;
  labourBalance: number;
  labourExtraPaid: number;

  toolsCost: number;
  toolsPaid: number;
  toolsBalance: number;
  toolsExtraPaid: number;

  teaSnacksCost: number;
  teaSnacksPaid: number;
  teaSnacksBalance: number;
  teaSnacksExtraPaid: number;

  poojaCost: number;
  poojaPaid: number;
  poojaBalance: number;
  poojaExtraPaid: number;

  electricityCost: number;
  electricityPaid: number;
  electricityBalance: number;
  electricityExtraPaid: number;

  waterCost: number;
  waterPaid: number;
  waterBalance: number;
  waterExtraPaid: number;

  otherCost: number;
  otherPaid: number;
  otherBalance: number;
  otherExtraPaid: number;

  totalCost: number;
  totalPaid: number;
  totalBalance: number;
  totalExtraPaid: number;
}

export interface Site {
  id: string;
  userId: string; // Bound to user/mistry owner
  name: string;
  ownerName: string;
  ownerPhone: string;
  address: string;
  area: string;
  district?: string;
  buildingType: string;
  startDate: string;
  expectedCompletionDate: string;
  status: SiteStatus;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MaterialCategory = 'sand' | 'msand' | 'cement' | 'rod' | 'bricks' | 'aggregate' | 'other';

export interface Material {
  id: string;
  userId?: string;
  siteId: string;
  category: MaterialCategory;
  materialName: string;
  supplier: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  purchaseDate: string;
  invoiceNumber?: string;
  brand?: string;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RodEntry {
  id: string;
  userId?: string;
  siteId: string;
  diameter: string; // '6 mm', '8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm' or custom
  brand?: string;
  quantityPieces?: number;
  unit: string; // 'kg', 'Tons', 'Bundles'
  weightKg: number;
  ratePerKg: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  supplier: string;
  purchaseDate: string;
  invoiceNumber?: string;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LabourCategory = 'SITHAAL' | 'PERIYAAL' | 'MISTRY' | string;

export interface LabourWorker {
  id: string;
  userId?: string;
  siteId: string; // primary site or pool
  name: string;
  phone: string;
  category: LabourCategory;
  dailyWage: number;
  joiningDate: string;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'overtime';

export interface AttendanceRecord {
  id: string;
  userId?: string;
  siteId: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  overtimeHours?: number;
  dayMultiplier: number; // 1 for present, 0.5 for half day, 0 for absent, 1.5 for overtime
  notes?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabourAdvance {
  id: string;
  userId?: string;
  siteId: string;
  workerId: string;
  date: string;
  amount: number;
  advanceType: 'Recoverable' | 'Non-Recoverable'; // Recoverable vs No Return / Non-Recoverable
  reason?: string;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryPayment {
  id: string;
  userId?: string;
  siteId: string;
  workerId: string;
  date: string;
  periodStart?: string;
  periodEnd?: string;
  daysWorked: number;
  grossSalary: number;
  advanceDeducted: number; // Only recoverable advances
  paidAmount: number;
  balance: number;
  extraPaid: number;
  paymentMode?: string;
  notes?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ToolItem {
  id: string;
  userId?: string;
  siteId: string;
  toolName: string;
  quantity: number;
  type: 'Purchase' | 'Rental' | 'Repair';
  cost: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  purchaseDate: string;
  supplier?: string;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeaSnacksExpense {
  id: string;
  userId?: string;
  siteId: string;
  date: string;
  teaExpense: number;
  snacksExpense: number;
  juiceExpense: number; // Separate tracking for Fresh Juice 🧃
  otherFoodExpense: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PoojaExpense {
  id: string;
  userId?: string;
  siteId: string;
  date: string;
  poojaName: string;
  materialsExpense: number;
  priestExpense: number;
  otherExpense: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ElectricityBill {
  id: string;
  userId?: string;
  siteId: string;
  month: string;
  meterNumber?: string;
  billAmount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  dueDate?: string;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WaterBill {
  id: string;
  userId?: string;
  siteId: string;
  date: string;
  supplier: string;
  quantityLoads?: string;
  billAmount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SiteComment {
  id: string;
  userId?: string;
  siteId: string;
  dateTime: string;
  category: 'General' | 'Delay' | 'Material' | 'Client Request' | 'Inspection' | 'Safety';
  commentText: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OtherExpenseCategory = 'Transport' | 'Repair' | 'Equipment' | 'Fuel' | 'Miscellaneous' | 'Other';

export interface OtherExpense {
  id: string;
  userId?: string;
  siteId: string;
  date: string;
  category: OtherExpenseCategory;
  description: string;
  amount: number;
  paidAmount: number;
  balance: number;
  extraPaid: number;
  notes?: string;
  imageUrl?: string;
  imageType?: string;
  imageAlt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface PaymentTransaction {
  id: string; // Payment ID
  userId?: string;
  siteId: string; // Site ID
  relatedRecordId: string; // Related Record ID
  module?: string; // 'Material' | 'Tool' | 'Labour' | 'DailyExpense' etc.
  date: string; // Date (YYYY-MM-DD)
  amount: number; // Amount
  paymentType: PaymentMethod | string; // Payment Type
  notes?: string; // Notes
  isDeleted: boolean;
  deletedAt?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'SUPER_ADMIN' | 'MISTRY_USER' | 'MISTRY' | 'SUB_ADMIN' | 'ADMIN';

export function isAdminRole(role?: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'SUB_ADMIN' || role === 'ADMIN';
}

export function isSuperAdminRole(role?: string, email?: string): boolean {
  const initialAdminEmail = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_EMAIL) || 'tamilthilagan82@gmail.com';
  return role === 'SUPER_ADMIN' || (email || '').toLowerCase() === initialAdminEmail.toLowerCase();
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  mobile: string;
  phoneNormalized?: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OtpSession {
  id: string;
  phoneNormalized: string;
  hashedOtp: string;
  salt: string;
  token?: string;
  expiresAt: number; // Unix timestamp in ms
  attempts: number;
  verified: boolean;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  affectedRecordId?: string;
  affectedTable?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  details?: string;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  siteId?: string;
  siteName?: string;
  action: string;
  description: string;
  amount?: number;
  timestamp: string;
}

export type EstimateMaterial = 'Cement' | 'Sand' | 'M-Sand' | 'Aggregate' | 'Bricks' | 'Steel';

export interface MaterialPriceQuote {
  id: string;
  userId?: string;
  material: EstimateMaterial;
  brand: string;
  product: string;
  grade?: string;
  size?: string;
  unit: string;
  price: number;
  supplier: string;
  district: string;
  area?: string;
  effectiveDate: string;
  updatedAt: string;
  source?: string;
  isDeleted: boolean;
  deletedAt?: string;
}

export type ConstructionQuality = 'Economy' | 'Standard' | 'Premium' | 'Custom';
export type StructureType = 'Framed Structure (RCC)' | 'Load Bearing' | 'Steel Frame' | 'Composite';
export type ConcreteGrade = 'M15' | 'M20' | 'M25' | 'M30' | 'Custom';
export type SteelGrade = 'Fe415' | 'Fe500' | 'Fe550' | 'Custom';
export type AreaUnit = 'sq.ft' | 'sq.m' | 'cent' | 'ground';

export interface EstimatedMaterialItem {
  material: EstimateMaterial;
  quantity: number;
  unit: string;
  rate: number;
  estimatedCost: number;
  supplierName?: string;
  priceDate?: string;
  factorUsed?: number;
  factorUnit?: string;
}

export interface BOQSteelItem {
  diameter: string;
  weightKg: number;
  ratePerKg: number;
  totalCost: number;
}

export interface BuildingEstimate {
  id: string;
  userId: string;
  siteId?: string;
  siteName?: string;
  estimateName: string;
  plotArea: number;
  plotAreaUnit: AreaUnit;
  builtUpArea: number;
  builtUpAreaUnit: AreaUnit;
  convertedBuiltUpSqFt: number;
  floors: number;
  buildingType: string;
  quality: ConstructionQuality;
  structureType: StructureType;
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  includeRiverSand: boolean;
  materialEstimates: EstimatedMaterialItem[];
  totalEstimatedMaterialCost: number;
  estimatedLabourCost: number;
  totalEstimatedCost: number;
  boqSteelSchedule?: BOQSteelItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
}

export type EntityTable =
  | 'sites'
  | 'materials'
  | 'rodEntries'
  | 'workers'
  | 'attendance'
  | 'labourAdvances'
  | 'salaryPayments'
  | 'tools'
  | 'teaSnacksExpenses'
  | 'poojaExpenses'
  | 'electricityBills'
  | 'waterBills'
  | 'siteComments'
  | 'otherExpenses'
  | 'materialPrices'
  | 'estimates'
  | 'payments';

export interface TrashRecord {
  id: string;
  userId?: string;
  userName?: string;
  tableName: EntityTable;
  entityType: string;
  title: string;
  subtitle: string;
  siteId?: string;
  siteName?: string;
  amount?: number;
  deletedAt: string;
  rawData: any;
}
