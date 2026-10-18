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
  // Pay policy for approved Leave days. Unset means the owner has not decided yet:
  // leave is then counted as unpaid and the app says so instead of guessing.
  leavePaid?: boolean;
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
  materialType?: string;   // e.g. cement type 'OPC' | 'PPC' | 'PSC'
  grade?: string;          // e.g. '43' | '53' (OPC only)
  catalogItemId?: string;
  createdBy?: string;
  updatedBy?: string;
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
  /** Recorded total rod length in metres; separate from diameter and weight. */
  lengthMetres?: number;
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

// 'leave' is an approved day off; whether it is paid comes from the site's pay policy.
// 'absent' is an unapproved no-show and is never paid.
export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'overtime' | 'leave';

export interface AttendanceEdit {
  at: string;          // ISO timestamp of the correction
  by?: string;         // user id
  byName?: string;
  from: AttendanceStatus;
  to: AttendanceStatus;
}

export interface AttendanceRecord {
  id: string;
  userId?: string;
  siteId: string;
  workerId: string;
  date: string; // Event date, YYYY-MM-DD in the site's timezone (Asia/Kolkata)
  status: AttendanceStatus;
  overtimeHours?: number;
  dayMultiplier: number; // 1 for present, 0.5 for half day, 0 for absent/leave, 1.5 for overtime
  dailyWageSnapshot?: number; // Wage on the day it was marked, so later wage changes don't rewrite history
  createdBy?: string;
  updatedBy?: string;
  editHistory?: AttendanceEdit[];
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
  createdBy?: string;
  updatedBy?: string;
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
  createdBy?: string;
  updatedBy?: string;
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
  createdBy?: string;
  updatedBy?: string;
  payee?: string;
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
  createdBy?: string;
  updatedBy?: string;
  payee?: string;
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
  createdBy?: string;
  updatedBy?: string;
  payee?: string;
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
  createdBy?: string;
  updatedBy?: string;
  payee?: string;
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
  createdBy?: string;
  updatedBy?: string;
  payee?: string;
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

export type UserRole = 'SUPER_ADMIN' | 'MISTRY_USER' | 'MISTRY' | 'SUB_ADMIN' | 'ADMIN' | 'HOUSE_OWNER';

export function isAdminRole(role?: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'SUB_ADMIN';
}

export function isSuperAdminRole(role?: string): boolean {
  return role === 'SUPER_ADMIN';
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
  permissions?: Record<string, { read: boolean; write: boolean }>;
  isActive: boolean;
  offlineLimited?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

const RECORD_PERMISSION_SCOPE: Record<string, string> = {
  sites: 'projects',
  siteComments: 'projects',
  workers: 'labour',
  attendance: 'labour',
  salaryPayments: 'payroll',
  labourAdvances: 'payroll',
  materials: 'materials',
  rodEntries: 'materials',
  stockMovements: 'materials',
  catalogItems: 'materials',
  tools: 'expenses',
  toolAssets: 'expenses',
  toolIssues: 'expenses',
  teaSnacksExpenses: 'expenses',
  poojaExpenses: 'expenses',
  electricityBills: 'expenses',
  waterBills: 'expenses',
  otherExpenses: 'expenses',
  payments: 'expenses',
  floorPlans: 'floor_plans',
  estimates: 'estimates',
  materialPrices: 'estimates',
  users: 'users',
};

/** Client-side UI gate only; Supabase RLS remains the authorization boundary. */
export function userCanAccessRecord(
  user: User,
  table: string,
  access: 'read' | 'write',
  ownerId: string | undefined
): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (ownerId === user.id) return true;
  if (user.role === 'HOUSE_OWNER') {
    if (access === 'read') {
      return ['sites', 'siteComments', 'floorPlans', 'estimates', 'materials', 'teaSnacksExpenses', 'poojaExpenses', 'electricityBills', 'waterBills', 'otherExpenses'].includes(table);
    }
    return ['floorPlans', 'estimates', 'siteComments'].includes(table) && ownerId === user.id;
  }
  if (user.role === 'SUB_ADMIN') {
    const scope = RECORD_PERMISSION_SCOPE[table];
    const permission = scope ? user.permissions?.[scope] : undefined;
    return access === 'write' ? permission?.write === true : permission?.read === true || permission?.write === true;
  }
  return false;
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
  /**
   * Estimates saved by the four-step calculator (optional, so older estimates still load).
   * In those, `plotArea` is the plot when it was given, otherwise the building size on one
   * floor; in older estimates it is always the size of one floor.
   */
  plotSqFt?: number | null;        // null: the plot size was not given
  footprintSqFt?: number;          // building size on one floor
  labourRatePerSqFt?: number;
  finishingRatePerSqFt?: number;   // 0: finishes and services not included
  finishingCost?: number;
  ratesUsed?: Record<string, number>;   // material needed per sq.ft, as used
  ratesChanged?: string[];              // which of those the user changed
  assumptions?: string[];
  /** The calculator's inputs exactly as entered, so the estimate reopens as it was. */
  inputs?: unknown;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
}

// ============================================================
// Floor Plan Creator — Geometry Types
// ============================================================

export type FloorPlanUnit = 'feet' | 'meters' | 'inches' | 'centimeters';

export type WallType = 'exterior' | 'interior' | 'partition' | 'structural';

export interface FloorPlanWall {
  id: string;
  x1: number;         // Start X in plan units
  y1: number;         // Start Y in plan units
  x2: number;         // End X in plan units
  y2: number;         // End Y in plan units
  thickness: number;  // Wall thickness in plan units
  thicknessMm?: number; // Wall thickness in mm (e.g. 100, 115, 150, 200, 230)
  height?: number;    // Height in plan units
  wallType: WallType;
  startNodeId?: string; // Connected vertex node ID
  endNodeId?: string;   // Connected vertex node ID
  color?: string;     // Optional override
  layerId?: string;
  layer?: string;
  locked?: boolean;
  // Where the length label is drawn, moved by dragging it: extra distance out from the wall
  // and a slide along it, in plan units. Display only: they never change the wall's length.
  dimensionOffset?: number;
  dimensionShift?: number;
}

export type RoomType =
  | 'Living Room' | 'Master Bedroom' | 'Bedroom' | 'Guest Room' | 'Kids Room'
  | 'Kitchen' | 'Dining' | 'Bathroom' | 'Toilet' | 'Utility' | 'Store' | 'Store Room'
  | 'Study' | 'Pooja' | 'Prayer Room' | 'Balcony' | 'Corridor' | 'Staircase'
  | 'Parking' | 'Garage' | 'Office' | 'Terrace' | 'Custom';

export type RoomShapeType = 'rectangle' | 'l-shape' | 'u-shape' | 't-shape' | 'polygon';

export interface FloorPlanRoom {
  id: string;
  roomType: RoomType;
  label: string;       // Display name (user editable)
  x: number;           // Top-left X
  y: number;           // Top-left Y
  width: number;       // Width in plan units
  height: number;      // Height in plan units
  area?: number;       // Computed area
  perimeter?: number;  // Computed perimeter
  shapeType?: RoomShapeType; // Room polygon shape archetype
  polygonPoints?: { x: number; y: number }[]; // Enclosed wall boundary vertices
  // True when the room is the space enclosed by walls. Its outline and area then follow
  // the walls automatically; a room placed by hand keeps the size it was given.
  fromWalls?: boolean;
  rotation: number;    // Degrees (0, 90, 180, 270)
  color?: string;
  floorFinish?: string;// e.g. 'Vitrified Tiles', 'Granite', 'Marble', 'Hardwood'
  wallThickness?: number; // Wall thickness in plan units
  ceilingHeight?: number;
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export type DoorType =
  | 'Single' | 'Double' | 'Main Entrance' | 'Sliding'
  | 'Pocket' | 'Bathroom' | 'Balcony' | 'French' | 'Opening' | 'Custom';

export interface FloorPlanDoor {
  id: string;
  doorType: DoorType;
  x: number;
  y: number;
  width: number;       // Door opening width in plan units
  height?: number;     // Standard 7 ft / 2.1 m
  rotation: number;    // 0 | 90 | 180 | 270
  wallId?: string;     // Which wall it belongs to / hosted on
  wallOffset?: number; // Offset along host wall from start node
  swingAngle?: number; // 0-90 for arc display
  frameThickness?: number; // Door frame jamb thickness
  hostWallThickness?: number; // Single source of truth host wall thickness
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export type WindowType =
  | 'Single Window' | 'Double Window' | 'Sliding Window' | 'Large Window'
  | 'Bay Window' | 'Corner Window' | 'Fixed Window' | 'Ventilator'
  | 'Standard' | 'Large' | 'Sliding' | 'Bay' | 'Corner' | 'Custom';

export interface FloorPlanWindow {
  id: string;
  windowType: WindowType;
  x: number;
  y: number;
  width: number;       // Window width in plan units
  height?: number;     // e.g. 4 ft
  sillHeight?: number; // e.g. 3 ft
  sillHeightMm?: number;
  frameThickness?: number; // Outer frame thickness
  hostWallThickness?: number; // Single source of truth host wall thickness
  rotation: number;
  wallId?: string;     // Which wall it belongs to / hosted on
  wallOffset?: number; // Offset along host wall
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export type FurnitureCategory =
  | 'Bedroom' | 'Living' | 'Dining & Study' | 'Kitchen' | 'Bathroom' | 'Utility' | 'Outdoor'
  | 'bedroom' | 'living' | 'dining' | 'kitchen' | 'bathroom' | 'utility' | 'outdoor'
  | 'furniture' | 'electrical' | 'plumbing' | 'structural' | 'custom';

export interface FloorPlanFurniture {
  id: string;
  category: FurnitureCategory;
  itemType: string;    // e.g. 'King Bed', '3-Seater Sofa', 'Dining Table 6', 'Toilet Commode'
  label: string;
  x: number;           // Position X in plan units
  y: number;           // Position Y in plan units
  width: number;       // Width in plan units
  height: number;      // Depth/Length in plan units
  depth?: number;      // Specific depth in plan units
  elevation?: number;  // Height above floor
  wallMounted?: boolean; // True for wall-mounted TV, Split AC, mirrors
  wallId?: string;     // Wall it snaps against
  rotation: number;    // 0, 45, 90, 135, 180, 225, 270, 315
  color?: string;
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export type StaircaseType = 'Straight' | 'L' | 'U' | 'Spiral';

export interface FloorPlanStaircase {
  id: string;
  stairType?: StaircaseType;
  type?: 'straight' | 'l-shape' | 'u-shape' | 'spiral';
  x: number;
  y: number;
  width: number;       // Staircase width (e.g. 3.25 ft / 1 m)
  length: number;      // Total run length (e.g. 10 ft / 3 m)
  rotation: number;    // 0, 90, 180, 270
  numSteps?: number;   // e.g. 16
  steps?: number;
  riserHeight?: number;// e.g. 7 inches
  treadWidth?: number; // e.g. 10 inches
  direction?: 'UP' | 'DOWN' | 'up' | 'down';
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export type StructuralType = 'Column' | 'Pillar' | 'Beam';
export type ColumnShape = 'square' | 'rectangular' | 'round';

export interface FloorPlanColumn {
  id: string;
  structType?: StructuralType;
  shape?: ColumnShape;
  x: number;
  y: number;
  width: number;       // e.g. 0.75 ft (9 inches)
  depth: number;       // e.g. 1.25 ft (15 inches)
  height?: number;     // e.g. 10 ft
  rotation?: number;
  material?: string;   // 'RCC M20', 'Steel', 'Brick'
  layerId?: string;
  layer?: string;
  label?: string;
  locked?: boolean;
}

export type AnnotationType = 'text' | 'dimension' | 'area' | 'north' | 'note' | 'scale' | 'room-label';

export interface FloorPlanAnnotation {
  id: string;
  annotType?: AnnotationType;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text: string;
  fontSize?: number;
  rotation?: number;
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export interface FloorPlanDimension {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distance: number;
  text?: string;
  unit?: FloorPlanUnit;
  orientation?: 'horizontal' | 'vertical' | 'aligned';
  targetType?: 'wall' | 'room' | 'custom';
  targetId?: string;
  layerId?: string;
  layer?: string;
  locked?: boolean;
}

export interface FloorPlanLayerConfig {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity?: number;
  color?: string;
}

export interface FloorPlanVersion {
  id?: string;
  versionId: string;
  versionNumber: number;
  timestamp: string;
  note: string;
  snapshot: string;    // JSON serialization of the plan geometry
}

export interface BackgroundPlanImage {
  id: string;
  url: string;        // data URL / blob URL
  x: number;          // plan coordinates
  y: number;
  width: number;      // calibrated plan width
  height: number;     // calibrated plan height
  opacity: number;    // 0.1 to 1.0 (default 0.5)
  visible: boolean;   // show/hide toggle
  locked: boolean;    // lock from accidental drag
  rotation?: number;
  fileName?: string;
}

export interface FloorPlanLevel {
  id: string;
  name: string;        // e.g. "Ground Floor", "First Floor", "Terrace"
  elevation?: number;  // in feet / meters
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  furniture?: FloorPlanFurniture[];
  stairs?: FloorPlanStaircase[];
  columns?: FloorPlanColumn[];
  annotations?: FloorPlanAnnotation[];
  dimensions?: FloorPlanDimension[];
  backgroundImage?: BackgroundPlanImage;
}

export interface FloorPlan {
  id: string;
  userId: string;
  siteId?: string;       // Optional site association
  siteName?: string;     // Denormalized for display
  buildingName: string;
  floorName: string;     // e.g. "Ground Floor", "First Floor"
  plotLength: number;    // Plot boundary length
  plotWidth: number;     // Plot boundary width
  unit: FloorPlanUnit;   // 'feet' | 'meters' | 'inches' | 'centimeters'
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  furniture?: FloorPlanFurniture[];
  stairs?: FloorPlanStaircase[];
  columns?: FloorPlanColumn[];
  annotations?: FloorPlanAnnotation[];
  dimensions?: FloorPlanDimension[];
  floors?: FloorPlanLevel[];
  backgroundImage?: BackgroundPlanImage;
  layers?: FloorPlanLayerConfig[];
  versionHistory?: FloorPlanVersion[];
  northRotation?: number; // 0, 45, 90, 180, 270
  scale?: string;         // '1:50', '1:100', '1:200', 'custom'
  ceilingHeight?: number; // e.g. 10 ft
  status?: 'draft' | 'completed';
  notes?: string;
  thumbnailDataUrl?: string;  // small self-contained preview (data URL)
  // Counts saves. A save must name the revision it started from; if the stored revision has
  // moved on (another tab or device saved first) the save is refused instead of overwriting.
  revision?: number;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Stock, catalog and tool tracking (schema v8, additive)
// ============================================================

export type CatalogKind = 'material' | 'brand' | 'tool' | 'cement_type';

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  category: string;        // material category, or tool category
  unit?: string;           // default unit for materials
  lowStockThreshold?: number | null;
  lowStockThresholdUnit?: string;
  description?: string;
  group?: string;          // materials: the shelf it is shown under (see MATERIAL_GROUPS)
  materialType?: string;   // cement types: composition, e.g. 'OPC' | 'PPC' | 'PSC'
  grade?: string;          // cement types: strength grade, e.g. '43' | '53'
  standard?: string;       // cement types: the Indian Standard, e.g. 'IS 269'
  imageUrl?: string;       // bundled path or user-supplied data URL
  imageCredit?: string;    // author + license for bundled photos
  isBuiltIn?: boolean;
  userId?: string;         // who added a custom entry
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Purchases stay in `materials` / `rodEntries` (they carry cost and payments).
// Everything else that changes stock is a StockMovement.
export type StockMovementType = 'opening' | 'usage' | 'return' | 'adjust_in' | 'adjust_out';

export interface StockMovement {
  id: string;
  userId?: string;
  siteId: string;
  itemKey: string;         // see domain/stock.ts stockItemKey()
  itemName: string;
  category: string;
  unit: string;
  movementType: StockMovementType;
  quantity: number;        // always positive; direction comes from movementType
  eventDate: string;       // YYYY-MM-DD
  reason?: string;
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  isDeleted: boolean;      // "voided": kept in history, excluded from the balance
  deletedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ToolCondition = 'Good' | 'Needs Repair' | 'Damaged' | 'Lost';

export interface ToolAsset {
  id: string;
  userId?: string;
  siteId: string;
  catalogItemId?: string;
  name: string;
  category: string;
  imageUrl?: string;
  imageCredit?: string;
  totalQuantity: number;
  condition: ToolCondition;
  notes?: string;
  createdBy?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolReturn {
  id: string;
  quantity: number;
  returnedAt: string;      // ISO timestamp
  condition: ToolCondition;
  notes?: string;
  recordedBy?: string;
}

export interface ToolIssue {
  id: string;
  userId?: string;
  siteId: string;
  toolAssetId: string;
  quantity: number;
  issuedTo: string;        // person receiving the tool
  workerId?: string;
  issuedAt: string;        // ISO timestamp
  expectedReturnDate?: string; // YYYY-MM-DD
  returns: ToolReturn[];
  notes?: string;
  createdBy?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================

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
  | 'payments'
  | 'floorPlans'
  | 'stockMovements'
  | 'catalogItems'
  | 'toolAssets'
  | 'toolIssues';

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
