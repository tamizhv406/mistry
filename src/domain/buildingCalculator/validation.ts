/**
 * Building Mistry — Advanced Building Calculator: Input Validation
 * Strict validation preventing invalid dimensions, division by zero, and negative quantities.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePositiveDimension(
  name: string,
  value: number,
  allowZero: boolean = false
): { error?: string; warning?: string } {
  if (!Number.isFinite(value) || isNaN(value)) {
    return { error: `${name} must be a valid number.` };
  }
  if (value < 0) {
    return { error: `${name} cannot be negative (${value}).` };
  }
  if (!allowZero && value === 0) {
    return { error: `${name} must be greater than zero.` };
  }
  return {};
}

export function validateWastagePercentage(
  percent: number,
  maxAllowed: number = 30
): { error?: string; warning?: string } {
  if (!Number.isFinite(percent) || isNaN(percent)) {
    return { error: 'Wastage percentage must be a valid number.' };
  }
  if (percent < 0) {
    return { error: 'Wastage percentage cannot be negative.' };
  }
  if (percent > maxAllowed) {
    return {
      warning: `Wastage is set to ${percent}%, which exceeds standard construction allowances (normal is 3% - 10%).`,
    };
  }
  return {};
}

export function validateMixProportions(
  cement: number,
  sand: number,
  coarseAgg: number = 0
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (cement <= 0) errors.push('Cement proportion must be greater than zero.');
  if (sand < 0) errors.push('Fine aggregate (sand) proportion cannot be negative.');
  if (coarseAgg < 0) errors.push('Coarse aggregate proportion cannot be negative.');

  const totalParts = cement + sand + coarseAgg;
  if (totalParts <= 0) {
    errors.push('Sum of mix proportions must be greater than zero.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateOpeningDeductions(
  totalArea: number,
  openingsArea: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (openingsArea < 0) {
    errors.push('Opening deductions cannot be negative.');
  }
  if (openingsArea > totalArea) {
    errors.push(
      `Total opening area (${openingsArea.toFixed(2)}) exceeds gross surface area (${totalArea.toFixed(2)}).`
    );
  } else if (totalArea > 0 && openingsArea >= totalArea * 0.8) {
    warnings.push(
      'Openings exceed 80% of the surface area. Please verify door/window dimensions.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

