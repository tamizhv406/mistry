/**
 * Building Mistry — Multi-Tier Construction Cost Estimator Engine
 * 
 * Supports:
 * - 3 Quality Packages: Standard (~₹1,550–₹1,650/sq.ft), Premium (~₹1,950–₹2,100/sq.ft) [Default], Luxury (~₹2,450–₹2,800+/sq.ft)
 * - Section A: Core Civil Structure (Grey Structure) - 6 items
 * - Section B: Turnkey Finishing & MEP (Architectural Package) - 7 items
 * - Reactive local unit rates overrides
 * - 5 KPI metrics, Category share breakdown (Structure, Finishing, Labour, MEP)
 * - Milestone payment schedule (20%, 20%, 25%, 15%, 15%, 5%)
 * - Scannable WhatsApp quotation text generator
 */

export type PackageType = 'standard' | 'premium' | 'luxury';

export interface PackageSpecification {
  id: PackageType;
  name: string;
  badge: string;
  rangePerSqFt: string;
  targetAvgRate: number; // reference baseline / sq.ft
  tagline: string;
  description: string;
  cement: string;
  steel: string;
  bricks: string;
  flooring: string;
  paint: string;
  doors: string;
  windows: string;
  sanitaryElectrical: string;
  waterInfra: string;
  specialInclusions?: string;
}

export const PACKAGE_SPECS: Record<PackageType, PackageSpecification> = {
  standard: {
    id: 'standard',
    name: 'Standard / Economy Package',
    badge: 'Budget Friendly',
    rangePerSqFt: '₹1,550 – ₹1,650 / sq.ft',
    targetAvgRate: 1570,
    tagline: 'Durable core construction with practical economy specifications',
    description: 'OPC/PPC Cement, Fe-500 TMT Steel, Country Red Bricks with reliable branded fixtures.',
    cement: 'OPC 43 / PPC Cement (Coromandel / Dalmia)',
    steel: 'Fe-500 TMT Steel (Kamachi / ARS / Pulkit)',
    bricks: 'Country Clay Red Bricks (9"×4.25"×2.75")',
    flooring: 'Standard Ceramic / 2×2 ft Vitrified Tiles (₹45–₹55/sq.ft)',
    paint: '1 coat primer + 2 coats Asian Paints Tractor Acrylic Emulsion',
    doors: 'Hardwood frame with Teak-finish flush doors, standard cylindrical locks',
    windows: 'Aluminium 2-track sliding windows with 4mm pinhead glass',
    sanitaryElectrical: 'Parryware / Cera basic CP fittings, Anchor Roma modular switches, Finolex wires',
    waterInfra: 'Overhead Sintex 1,000L PVC Tank + 4,000L Brick Masonry Sump',
  },
  premium: {
    id: 'premium',
    name: 'Premium Package',
    badge: 'Most Popular',
    rangePerSqFt: '₹1,950 – ₹2,100 / sq.ft',
    targetAvgRate: 1990,
    tagline: 'Superior high-strength materials, designer finishes, and modern MEP',
    description: 'OPC 53 Grade Cement, Fe-550D TMT Steel, Wire-cut Bricks / AAC Blocks, Teak entrance, 4×2 GVT tiles.',
    cement: 'OPC 53 Grade Cement (Ultratech / Ramco Supergrade)',
    steel: 'Fe-550D Primary TMT Steel (Tata Tiscon / JSW Neosteel)',
    bricks: 'First-class Wire-cut Chamber Bricks / Autoclaved AAC Blocks',
    flooring: '4×2 ft High-gloss Glazed Vitrified Tiles (₹85–₹110/sq.ft) with Granite borders',
    paint: '2 coats Birla White Putty + Asian Paints Royale Luxury Emulsion',
    doors: 'Solid 1st-quality Teakwood main entrance door (3.5\'×7\') + Flush veneer interior doors',
    windows: '3-track UPVC sliding windows with Saint-Gobain toughened glass & SS mosquito mesh',
    sanitaryElectrical: 'Jaquar / Kohler CP fittings & wall-hung commodes, Finolex FRLS concealed wiring, Legrand/Schneider switches',
    waterInfra: 'Overhead 1,000L 4-layer UV-shield PVC Tank + 6,000L RCC Sump with crystalline waterproofing',
    specialInclusions: 'Anti-termite treatment warranty, waterproofing for sunken slabs & terrace',
  },
  luxury: {
    id: 'luxury',
    name: 'Luxury / Architectural Package',
    badge: 'Executive Grade',
    rangePerSqFt: '₹2,450 – ₹2,800+ / sq.ft',
    targetAvgRate: 2673,
    tagline: 'Ultra-luxury bespoke villa construction with smart automation and imported finishes',
    description: 'Fe-550D rebar, Italian Marble / Hardwood flooring, Burma Teakwood joinery, Grohe/Toto smart sanitaryware.',
    cement: 'OPC 53 Grade Ultratech Super / Coromandel King',
    steel: 'Fe-550D Tata Tiscon / SAIL CRS (Corrosion Resistant Steel)',
    bricks: 'High-density Wire-cut Red Bricks or Precision Interlocking Porotherm Blocks',
    flooring: 'Imported Italian Marble (Dyna/Bottochino) / Engineered Hardwood (₹200–₹350/sq.ft)',
    paint: 'Texture coats + Asian Paints Royale Aspira / PU gloss coating on all woodwork',
    doors: 'Designer 8ft Burma Teakwood pivot door with Yale biometric smart lock + flush acoustic doors',
    windows: 'Schüco / Fenesta architectural soundproof UPVC / thermal-break aluminium systems',
    sanitaryElectrical: 'Grohe / Toto wall-hung smart commodes & thermostatic diverters, Havells automation-ready wiring & touch panels',
    waterInfra: '2,000L 5-layer antibacterial tank + 8,000L monolithic RCC Sump with automated pressure booster pump',
    specialInclusions: 'Solar rooftop conduit provisioning, heat-reflective SRI terrace tiles, acoustic insulation',
  },
};

export interface MultiTierRateItem {
  key: string;
  label: string;
  unit: string;
  section: 'A' | 'B';
  category: 'structure' | 'finishing' | 'labour' | 'mep';
  standardRate: number;
  premiumRate: number;
  luxuryRate: number;
  specNotes?: string;
}

export const MULTI_TIER_RATE_ITEMS: MultiTierRateItem[] = [
  // Section A: Core Civil Structure (6 items)
  {
    key: 'cement',
    label: 'Cement',
    unit: 'bags',
    section: 'A',
    category: 'structure',
    standardRate: 395,
    premiumRate: 420,
    luxuryRate: 445,
    specNotes: '50kg bag (PPC / OPC 53 Grade)',
  },
  {
    key: 'steel',
    label: 'TMT Reinforcement Steel',
    unit: 'kg',
    section: 'A',
    category: 'structure',
    standardRate: 70,
    premiumRate: 74,
    luxuryRate: 79,
    specNotes: 'Fe-500 to Fe-550D primary billets',
  },
  {
    key: 'msand',
    label: 'Concrete & Masonry M-Sand',
    unit: 'cft',
    section: 'A',
    category: 'structure',
    standardRate: 42,
    premiumRate: 45,
    luxuryRate: 48,
    specNotes: 'IS 383 Zone II washed manufactured sand',
  },
  {
    key: 'aggregates',
    label: 'Coarse Aggregates (20mm / 40mm)',
    unit: 'cft',
    section: 'A',
    category: 'structure',
    standardRate: 38,
    premiumRate: 42,
    luxuryRate: 45,
    specNotes: 'Machine crushed angular blue metal jelly',
  },
  {
    key: 'bricks',
    label: 'Bricks / AAC Blocks',
    unit: 'nos',
    section: 'A',
    category: 'structure',
    standardRate: 9.5,
    premiumRate: 10.5,
    luxuryRate: 12.0,
    specNotes: 'Chamber burnt table-moulded or AAC',
  },
  {
    key: 'structural_labour',
    label: 'Structural Civil Labour',
    unit: 'sq.ft',
    section: 'A',
    category: 'labour',
    standardRate: 250,
    premiumRate: 320,
    luxuryRate: 380,
    specNotes: 'Footing, shuttering, rebar binding, casting, brickwork',
  },

  // Section B: Turnkey Finishing & MEP (7 items)
  {
    key: 'flooring',
    label: 'Flooring, Skirting & Dado',
    unit: 'sq.ft',
    section: 'B',
    category: 'finishing',
    standardRate: 75,
    premiumRate: 150,
    luxuryRate: 280,
    specNotes: 'Tile/stone supply + bed mortar + skilled laying',
  },
  {
    key: 'painting',
    label: 'Interior & Exterior Painting',
    unit: 'sq.ft',
    section: 'B',
    category: 'finishing',
    standardRate: 18,
    premiumRate: 32,
    luxuryRate: 52,
    specNotes: 'Putty + primer + 2 coats premium emulsion',
  },
  {
    key: 'doors',
    label: 'Main & Interior Doors',
    unit: 'lot',
    section: 'B',
    category: 'finishing',
    standardRate: 50000,
    premiumRate: 110000,
    luxuryRate: 190000,
    specNotes: 'Teak main entrance + flush veneer internal doors + hardware',
  },
  {
    key: 'windows',
    label: 'UPVC / Aluminium Windows',
    unit: 'sq.ft',
    section: 'B',
    category: 'finishing',
    standardRate: 360,
    premiumRate: 600,
    luxuryRate: 1100,
    specNotes: 'Sliding / casement frames + glass + mosquito mesh',
  },
  {
    key: 'plumbing_sanitary',
    label: 'Concealed Plumbing & Sanitaryware',
    unit: 'per bath',
    section: 'B',
    category: 'mep',
    standardRate: 26000,
    premiumRate: 40000,
    luxuryRate: 75000,
    specNotes: 'CPVC pipes + sanitaryware + CP fittings + labour per bathroom',
  },
  {
    key: 'electrical',
    label: 'Concealed Electrical Wiring & DB',
    unit: 'lot',
    section: 'B',
    category: 'mep',
    standardRate: 45000,
    premiumRate: 65000,
    luxuryRate: 120000,
    specNotes: 'FRLS copper conduit wiring, modular switches, DB & MCBs',
  },
  {
    key: 'water_infra',
    label: 'Water Infrastructure (Tank & Sump)',
    unit: 'set',
    section: 'B',
    category: 'mep',
    standardRate: 50000,
    premiumRate: 65000,
    luxuryRate: 110000,
    specNotes: 'Overhead PVC/SS tank + Underground RCC Sump + connections',
  },
];

export interface BOQItemLine {
  id: string;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  unitRate: number;
  amount: number;
  category: 'structure' | 'finishing' | 'labour' | 'mep';
}

export interface PaymentMilestone {
  stage: string;
  percentage: number;
  amount: number;
  deliverables: string;
}

export interface MultiTierEstimateResult {
  builtUpArea: number;
  packageType: PackageType;
  specification: PackageSpecification;
  sectionAItems: BOQItemLine[];
  sectionBItems: BOQItemLine[];
  totalCivilStructureCost: number;
  totalFinishingCost: number;
  totalLabourCost: number;
  totalMepCost: number;
  materialSubtotal: number;
  labourSubtotal: number;
  grandTotal: number;
  costPerSqFt: number;
  categoryPercentages: {
    structure: number;
    finishing: number;
    labour: number;
    mep: number;
  };
  milestones: PaymentMilestone[];
  customRatesApplied: Record<string, number>;
}

/**
 * Return default rates dictionary for a chosen package
 */
export function getDefaultPackageRates(pkg: PackageType): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of MULTI_TIER_RATE_ITEMS) {
    if (pkg === 'standard') map[item.key] = item.standardRate;
    else if (pkg === 'luxury') map[item.key] = item.luxuryRate;
    else map[item.key] = item.premiumRate;
  }
  return map;
}

/**
 * Calculate complete multi-tier commercial estimate for a given built-up area and quality package
 */
export function calculateMultiTierEstimate(
  builtUpArea: number,
  packageType: PackageType = 'premium',
  customRatesOverride?: Record<string, number>
): MultiTierEstimateResult {
  const area = Math.max(100, builtUpArea || 1000);
  const scale = area / 1000;
  const spec = PACKAGE_SPECS[packageType] || PACKAGE_SPECS.premium;
  const defaultRates = getDefaultPackageRates(packageType);
  const activeRates = { ...defaultRates, ...(customRatesOverride || {}) };

  // Section A: Core Civil Structure Quantities (Tamil Nadu IS 456 thumb rules)
  // Per 1,000 sq.ft: 480 bags cement, 4,500 kg steel, 2,500 cft M-sand, 1,750 cft aggregate, 25,000 bricks
  const cementQty = Math.round(480 * scale);
  const steelQty = Math.round(4500 * scale);
  const msandQty = Math.round(2500 * scale);
  const aggQty = Math.round(1750 * scale);
  const bricksQty = Math.round(25000 * scale);
  const civilLabourQty = Math.round(area);

  const sectionAItems: BOQItemLine[] = [
    {
      id: 'cement',
      name: 'Cement (PPC / OPC 53 Grade)',
      specification: spec.cement,
      quantity: cementQty,
      unit: 'bags',
      unitRate: activeRates.cement,
      amount: cementQty * activeRates.cement,
      category: 'structure',
    },
    {
      id: 'steel',
      name: 'TMT Reinforcement Steel',
      specification: spec.steel,
      quantity: steelQty,
      unit: 'kg',
      unitRate: activeRates.steel,
      amount: steelQty * activeRates.steel,
      category: 'structure',
    },
    {
      id: 'msand',
      name: 'Manufactured Sand (M-Sand)',
      specification: 'IS 383 Zone II washed crusher sand for concrete & masonry',
      quantity: msandQty,
      unit: 'cft',
      unitRate: activeRates.msand,
      amount: msandQty * activeRates.msand,
      category: 'structure',
    },
    {
      id: 'aggregates',
      name: 'Coarse Aggregates (20mm / 40mm)',
      specification: 'Blue metal machine crushed angular jelly',
      quantity: aggQty,
      unit: 'cft',
      unitRate: activeRates.aggregates,
      amount: aggQty * activeRates.aggregates,
      category: 'structure',
    },
    {
      id: 'bricks',
      name: 'Bricks / AAC Masonry Blocks',
      specification: spec.bricks,
      quantity: bricksQty,
      unit: 'nos',
      unitRate: activeRates.bricks,
      amount: Math.round(bricksQty * activeRates.bricks),
      category: 'structure',
    },
    {
      id: 'structural_labour',
      name: 'Civil Structural Labour Package',
      specification: 'Footing, shuttering, rebar binding, concrete casting, brickwork & scaffolding',
      quantity: civilLabourQty,
      unit: 'sq.ft',
      unitRate: activeRates.structural_labour,
      amount: civilLabourQty * activeRates.structural_labour,
      category: 'labour',
    },
  ];

  // Section B: Turnkey Finishing & MEP Quantities
  // Approx 1.1x area for flooring & skirting, 3.5x area for painting surface
  const flooringArea = Math.round(area * 1.1);
  const paintingArea = Math.round(area * 3.5);
  const windowArea = Math.round(area * 0.15); // ~150 sq.ft per 1,000 sq.ft
  const bathroomCount = Math.max(1, Math.round(area / 550)); // ~2 bathrooms per 1,000 sq.ft

  // Scaled lump sums for doors, electrical, and water infrastructure
  const doorsAmount = Math.round(activeRates.doors * scale);
  const electricalAmount = Math.round(activeRates.electrical * scale);
  const waterInfraAmount = Math.round(activeRates.water_infra * (0.5 + 0.5 * scale));

  const sectionBItems: BOQItemLine[] = [
    {
      id: 'flooring',
      name: 'Flooring, Skirting & Bathroom Dado',
      specification: spec.flooring,
      quantity: flooringArea,
      unit: 'sq.ft',
      unitRate: activeRates.flooring,
      amount: flooringArea * activeRates.flooring,
      category: 'finishing',
    },
    {
      id: 'painting',
      name: 'Interior & Exterior Architectural Painting',
      specification: spec.paint,
      quantity: paintingArea,
      unit: 'sq.ft',
      unitRate: activeRates.painting,
      amount: paintingArea * activeRates.painting,
      category: 'finishing',
    },
    {
      id: 'doors',
      name: 'Main Entrance & Interior Room Doors',
      specification: spec.doors,
      quantity: 1,
      unit: 'lot',
      unitRate: doorsAmount,
      amount: doorsAmount,
      category: 'finishing',
    },
    {
      id: 'windows',
      name: 'UPVC / Architectural Windows & Ventilators',
      specification: spec.windows,
      quantity: windowArea,
      unit: 'sq.ft',
      unitRate: activeRates.windows,
      amount: windowArea * activeRates.windows,
      category: 'finishing',
    },
    {
      id: 'plumbing_sanitary',
      name: 'Concealed Plumbing & Sanitaryware',
      specification: `${spec.sanitaryElectrical} (${bathroomCount} attached bathrooms)`,
      quantity: bathroomCount,
      unit: 'baths',
      unitRate: activeRates.plumbing_sanitary,
      amount: bathroomCount * activeRates.plumbing_sanitary,
      category: 'mep',
    },
    {
      id: 'electrical',
      name: 'Concealed Electrical Wiring, DB & Modular Switches',
      specification: 'Fire-retardant wiring, distribution boards, MCBs & designer switchplates',
      quantity: 1,
      unit: 'lot',
      unitRate: electricalAmount,
      amount: electricalAmount,
      category: 'mep',
    },
    {
      id: 'water_infra',
      name: 'Water Infrastructure (Overhead Tank & RCC Sump)',
      specification: spec.waterInfra,
      quantity: 1,
      unit: 'set',
      unitRate: waterInfraAmount,
      amount: waterInfraAmount,
      category: 'mep',
    },
  ];

  // Calculate totals by functional category
  let totalCivilStructureCost = 0;
  let totalFinishingCost = 0;
  let totalLabourCost = 0;
  let totalMepCost = 0;

  const allItems = [...sectionAItems, ...sectionBItems];
  for (const item of allItems) {
    if (item.category === 'structure') totalCivilStructureCost += item.amount;
    else if (item.category === 'finishing') totalFinishingCost += item.amount;
    else if (item.category === 'labour') totalLabourCost += item.amount;
    else if (item.category === 'mep') totalMepCost += item.amount;
  }

  // Also include finishing labour embedded inside finishing items for true Labour subtotal display
  const finishingLabourComponent = Math.round(totalFinishingCost * 0.25);
  const pureFinishingMaterials = totalFinishingCost - finishingLabourComponent;

  const materialSubtotal = totalCivilStructureCost + pureFinishingMaterials + Math.round(totalMepCost * 0.7);
  const labourSubtotal = totalLabourCost + finishingLabourComponent + Math.round(totalMepCost * 0.3);
  const grandTotal = totalCivilStructureCost + totalFinishingCost + totalLabourCost + totalMepCost;
  const costPerSqFt = Math.round(grandTotal / area);

  // Exact category percentages
  const safeGrand = grandTotal || 1;
  const categoryPercentages = {
    structure: Math.round((totalCivilStructureCost / safeGrand) * 100),
    finishing: Math.round((totalFinishingCost / safeGrand) * 100),
    labour: Math.round((totalLabourCost / safeGrand) * 100),
    mep: Math.round((totalMepCost / safeGrand) * 100),
  };

  // Milestone Payment Schedule (20%, 20%, 25%, 15%, 15%, 5%)
  const milestones: PaymentMilestone[] = [
    {
      stage: 'Foundation & Plinth Stage',
      percentage: 20,
      amount: Math.round(grandTotal * 0.20),
      deliverables: 'Earthwork excavation, PCC, footing columns, plinth beam casting & backfilling',
    },
    {
      stage: 'Lintel & Brickwork Stage',
      percentage: 20,
      amount: Math.round(grandTotal * 0.20),
      deliverables: 'Ground/Floor columns, complete brick/block masonry up to lintel & lintel beam casting',
    },
    {
      stage: 'Roof Slab Casting Stage',
      percentage: 25,
      amount: Math.round(grandTotal * 0.25),
      deliverables: 'Formwork shuttering, rebar fabrication, electrical conduit laying & RCC slab casting',
    },
    {
      stage: 'Plastering & Brickwork Finish',
      percentage: 15,
      amount: Math.round(grandTotal * 0.15),
      deliverables: 'Parapet wall masonry, internal & external ceiling and wall plastering with curing',
    },
    {
      stage: 'Flooring, MEP & Painting',
      percentage: 15,
      amount: Math.round(grandTotal * 0.15),
      deliverables: 'Vitrified tiles/granite laying, sanitary fittings, wiring & final emulsion painting',
    },
    {
      stage: 'Final Handover & Snag Rectification',
      percentage: 5,
      amount: Math.round(grandTotal * 0.05),
      deliverables: 'Deep cleaning, lock fixing, touch-ups, site clearance and key handover',
    },
  ];

  return {
    builtUpArea: area,
    packageType,
    specification: spec,
    sectionAItems,
    sectionBItems,
    totalCivilStructureCost,
    totalFinishingCost,
    totalLabourCost,
    totalMepCost,
    materialSubtotal,
    labourSubtotal,
    grandTotal,
    costPerSqFt,
    categoryPercentages,
    milestones,
    customRatesApplied: activeRates,
  };
}

/**
 * Generate a clean, scannable WhatsApp quote text formatted with bold markdown
 */
export function generateWhatsAppQuoteText(
  estimate: MultiTierEstimateResult,
  clientName: string = 'Esteemed Client',
  projectName: string = 'Turnkey Residential Villa'
): string {
  const formatINR = (val: number) =>
    '₹' + Math.round(val).toLocaleString('en-IN');

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lines = [
    `*BUILDING MISTRY — TURNKEY CONSTRUCTION ESTIMATE*`,
    `═════════════════════════════════`,
    `📋 *Project:* ${projectName}`,
    `👤 *Client:* ${clientName}`,
    `📅 *Date:* ${dateStr}`,
    ``,
    `📐 *Total Built-Up Area:* ${estimate.builtUpArea.toLocaleString('en-IN')} sq.ft`,
    `💎 *Quality Package:* ${estimate.specification.name} (${estimate.specification.badge})`,
    `💰 *Estimated Cost / sq.ft:* ${formatINR(estimate.costPerSqFt)} / sq.ft`,
    `🏷️ *GRAND TOTAL ESTIMATE:* *${formatINR(estimate.grandTotal)}*`,
    ``,
    `📊 *COST BREAKDOWN:*`,
    `• Core Civil Structure: ${formatINR(estimate.totalCivilStructureCost)} (${estimate.categoryPercentages.structure}%)`,
    `• Finishing & Joinery: ${formatINR(estimate.totalFinishingCost)} (${estimate.categoryPercentages.finishing}%)`,
    `• Civil Labour Package: ${formatINR(estimate.totalLabourCost)} (${estimate.categoryPercentages.labour}%)`,
    `• Plumbing & Electrical (MEP): ${formatINR(estimate.totalMepCost)} (${estimate.categoryPercentages.mep}%)`,
    ``,
    `🏗️ *KEY SPECIFICATIONS:*`,
    `• Cement: ${estimate.specification.cement}`,
    `• Steel: ${estimate.specification.steel}`,
    `• Bricks: ${estimate.specification.bricks}`,
    `• Flooring: ${estimate.specification.flooring}`,
    `• Painting: ${estimate.specification.paint}`,
    `• Windows: ${estimate.specification.windows}`,
    `• Doors: ${estimate.specification.doors}`,
    `• Water: ${estimate.specification.waterInfra}`,
    ``,
    `💳 *MILESTONE PAYMENT SCHEDULE:*`,
    ...estimate.milestones.map(
      (m, idx) => `${idx + 1}. ${m.stage} (${m.percentage}%): *${formatINR(m.amount)}*`
    ),
    ``,
    `═════════════════════════════════`,
    `_Generated via Building Mistry ERP — Verified Civil Engineering Estimation Engine_`,
  ];

  return lines.join('\n');
}
