/**
 * Building Mistry — Advanced Building Calculator: Sand Classification System
 * Civil Engineering standard classification per IS 383:2016 and site quality specifications.
 */

import type { SandCategory, SandSpecification, SandTradeDescriptor, CalculatorModule } from './types';

export interface SandCategoryDefinition {
  category: SandCategory;
  name: string;
  intendedUse: string;
  standardGradingZone: string;
  recommendedMaxSiltPercent: number;
  nominalBulkDensityKgPerM3: number; // kg/m3
  description: string;
  engineeringGuideline: string;
}

export const SAND_CATEGORIES_REGISTRY: Record<SandCategory, SandCategoryDefinition> = {
  m_sand_concrete: {
    category: 'm_sand_concrete',
    name: 'Concrete-Grade M-Sand (Manufactured Sand)',
    intendedUse: 'Reinforced Concrete (RCC), Slabs, Beams, Columns, Foundations',
    standardGradingZone: 'IS 383:2016 Zone II',
    recommendedMaxSiltPercent: 5.0, // Micro-fines <= 5% (IS 383)
    nominalBulkDensityKgPerM3: 1650.0,
    description: 'Crushed rock fine aggregate with cubical particle shape and balanced particle size distribution.',
    engineeringGuideline:
      'Must comply with IS 383 Zone II grading. For structural RCC, use is subject to approved mix design and 28-day compressive strength testing.',
  },
  p_sand_plaster: {
    category: 'p_sand_plaster',
    name: 'Plastering P-Sand (Manufactured Plaster Sand)',
    intendedUse: 'Internal wall plastering, External plastering, Ceiling plaster',
    standardGradingZone: 'IS 1542 / IS 383 Zone IV',
    recommendedMaxSiltPercent: 7.0, // Fines <= 7% per IS 1542
    nominalBulkDensityKgPerM3: 1550.0,
    description: 'Fine washed manufactured sand sieved below 2.36 mm to prevent surface cracking, flaking, and rough finish.',
    engineeringGuideline:
      'Recommended for 12 mm to 20 mm plastering. Particles larger than 2.36 mm must be removed to prevent shrinkage cracks.',
  },
  masonry_sand: {
    category: 'masonry_sand',
    name: 'Masonry Sand (Brick & Block Mortar Sand)',
    intendedUse: 'Brick masonry joints, Concrete blockwork, AAC block thin-bed mortar',
    standardGradingZone: 'IS 2116 / IS 383 Zone III',
    recommendedMaxSiltPercent: 6.0,
    nominalBulkDensityKgPerM3: 1600.0,
    description: 'Coarse to medium sand providing strong mechanical interlock in bed joints and structural masonry.',
    engineeringGuideline:
      'Per IS 2116, sand for masonry mortar must be free from deleterious clay lumps, pyrites, and excessive organic matter.',
  },
  river_sand: {
    category: 'river_sand',
    name: 'Natural River Sand (Where Legally Permitted)',
    intendedUse: 'Masonry, Plastering, or Concrete subject to environmental clearance',
    standardGradingZone: 'Zone II / Zone III depending on river bed origin',
    recommendedMaxSiltPercent: 3.0,
    nominalBulkDensityKgPerM3: 1600.0,
    description: 'Naturally weathered river bed sand with rounded grains. Requires legal quarry transit pass and test certificate.',
    engineeringGuideline:
      'Only permissible when legally sourced with valid mineral transit passes. Silt and clay content must be verified via field jar settling test.',
  },
  custom_sand: {
    category: 'custom_sand',
    name: 'Custom / Site-Specific Sand',
    intendedUse: 'User-specified construction application',
    standardGradingZone: 'Site-tested',
    recommendedMaxSiltPercent: 5.0,
    nominalBulkDensityKgPerM3: 1600.0,
    description: 'Locally sourced or blended quarry sand with custom physical properties.',
    engineeringGuideline:
      'Physical testing (sieve analysis, specific gravity, silt content) is mandatory prior to structural use.',
  },
};

/**
 * Creates default sand specifications for each module with safety defaults.
 */
export function createDefaultSandSpecification(category: SandCategory): SandSpecification {
  const def = SAND_CATEGORIES_REGISTRY[category];
  return {
    category,
    tradeDescriptor: category === 'p_sand_plaster' ? 'fine' : 'coarse',
    zoneGrading:
      category === 'm_sand_concrete'
        ? 'Zone II'
        : category === 'p_sand_plaster'
        ? 'Zone IV'
        : category === 'masonry_sand'
        ? 'Zone III'
        : 'Unspecified',
    siltContentPercent: category === 'p_sand_plaster' ? 5 : 2,
    moisturePercent: 2.0, // Typical ambient surface moisture ~2%
    densityKgPerM3: def.nominalBulkDensityKgPerM3,
    labReportVerified: false,
    notes: '',
  };
}

export const getSandSpecByCategory = createDefaultSandSpecification;

/**
 * Evaluates sand suitability for a specific calculator module.
 * Produces structured warnings regarding "Soft sand" / "Hard sand" trade descriptions
 * and missing test verification reports.
 */
export interface SandSuitabilityEvaluation {
  isSuitable: boolean;
  unsuitable: boolean;
  warnings: string[];
  alerts: string[];
  recommendations: string[];
}

export function evaluateSandSuitability(
  spec: SandSpecification,
  intendedModule: CalculatorModule
): SandSuitabilityEvaluation {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const def = SAND_CATEGORIES_REGISTRY[spec.category];

  // 1. Trade descriptor warning: Soft vs Hard sand
  if (spec.tradeDescriptor === 'soft') {
    warnings.push(
      'Notice: "Soft sand" is a supplier trade description, not a certified engineering grade. Verify fineness modulus and silt content before use.'
    );
  }
  if (spec.tradeDescriptor === 'hard') {
    warnings.push(
      'Notice: "Hard sand" is an informal trade term. Do not assume suitability for structural concrete without particle size analysis.'
    );
  }

  // 2. Concrete (Slab, Beam, Column) checks
  if (intendedModule === 'slab' || intendedModule === 'beam' || intendedModule === 'column') {
    if (spec.category === 'p_sand_plaster') {
      warnings.push(
        'CRITICAL: Plastering P-Sand is too fine for structural RCC. Using fine sand in structural concrete causes high water demand and reduced compressive strength.'
      );
    }
    if (spec.category !== 'm_sand_concrete' && spec.category !== 'river_sand') {
      warnings.push(
        'Warning: Non-concrete grade sand selected for RCC element. Structural concrete must use approved Concrete-Grade M-Sand (Zone II).'
      );
    }
    if (!spec.labReportVerified) {
      warnings.push(
        'Quality Alert: No approved 28-day mix design or sieve test report recorded for this sand in structural concrete.'
      );
    }
  }

  // 3. Plastering checks
  if (intendedModule === 'plaster') {
    if (spec.category === 'm_sand_concrete') {
      warnings.push(
        'Warning: Concrete-grade M-Sand contains coarse particles (> 2.36 mm) that can cause plaster trowel marks, waviness, and surface map-cracking.'
      );
      recommendations.push('Use washed Plastering P-Sand (Zone IV) sieved below 2.36 mm for smooth wall finish.');
    }
  }

  // 4. Silt content check
  if (spec.siltContentPercent !== undefined) {
    if (spec.siltContentPercent > def.recommendedMaxSiltPercent) {
      warnings.push(
        `High Silt Alert: Silt content of ${spec.siltContentPercent}% exceeds the recommended maximum of ${def.recommendedMaxSiltPercent}% for ${def.name}. Excessive silt weakens bond strength and causes high shrinkage cracking.`
      );
    }
  } else {
    recommendations.push('Perform a field jar silt test to ensure silt content is within permissible limits.');
  }

  // 5. Moisture bulking notice
  if (spec.moisturePercent && spec.moisturePercent >= 3 && spec.moisturePercent <= 8) {
    recommendations.push(
      `Moisture Bulking: Damp sand at ${spec.moisturePercent}% moisture experiences volume bulking up to 15%-25%. If measuring by volume (CFT/brass), add a bulking correction.`
    );
  }

  const alerts: string[] = [];
  let unsuitable = false;

  if (intendedModule === 'slab' || intendedModule === 'beam' || intendedModule === 'column') {
    if (spec.tradeDescriptor === 'soft' || spec.category === 'p_sand_plaster') {
      unsuitable = true;
      alerts.push('UNSUITABLE FOR STRUCTURAL RCC: Plaster P-Sand or unwashed soft sand does not satisfy IS 383 Zone II structural concrete requirements.');
    }
  }

  return {
    isSuitable: warnings.length === 0 && !unsuitable,
    unsuitable,
    warnings,
    alerts,
    recommendations,
  };
}

/**
 * Calculates volumetric bulking factor based on moisture content percentage.
 * Clean civil engineering bulking curve: peaks around 5%-6% moisture.
 */
export function calculateBulkingFactor(moisturePercent: number): number {
  if (!Number.isFinite(moisturePercent) || moisturePercent <= 0) return 1.0;
  if (moisturePercent > 15) return 1.0; // Saturated sand collapses back to dry volume
  // Peak bulking of ~25% (1.25) around 5% moisture
  if (moisturePercent <= 5) {
    return 1.0 + (moisturePercent / 5) * 0.25;
  } else {
    return 1.25 - ((moisturePercent - 5) / 10) * 0.25;
  }
}
