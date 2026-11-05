/**
 * Building Mistry — Advanced Building Calculator: Bill of Quantities (BOQ) & Project Consolidation Engine
 * Consolidates quantities across multiple structural and finishing modules, summarizes costs,
 * and benchmarks against actual material consumption from site inventory.
 */

import type {
  BaseCalculationResult,
  ProjectBOQEstimate,
  ItemCostBreakdown,
} from './types';
import { round } from './conversions';

export interface SiteMaterialRecordSummary {
  name: string;
  quantityUsed: number;
  unit: string;
}

export function consolidateBOQ(
  projectName: string,
  calculations: { id: string; result: BaseCalculationResult; siteId?: string }[],
  siteId?: string,
  siteName?: string,
  actualMaterialsOnSite?: SiteMaterialRecordSummary[]
): ProjectBOQEstimate {
  const consolidatedMap = new Map<string, {
    materialName: string;
    totalQuantity: number;
    unit: string;
    totalBaseCost: number;
    totalTransportCost: number;
    totalTaxCost: number;
    totalCost: number;
  }>();

  let totalEstimateCost = 0;
  let totalLabourCost = 0;
  const calculationIds: string[] = [];

  for (const calc of calculations) {
    calculationIds.push(calc.id);
    const costs = calc.result.costs;
    if (!costs) continue;

    totalLabourCost += costs.labourCost || 0;

    for (const item of costs.materialItems) {
      const key = `${item.materialName.toLowerCase().trim()}_${item.unit.toLowerCase().trim()}`;
      const existing = consolidatedMap.get(key);

      if (existing) {
        existing.totalQuantity = round(existing.totalQuantity + item.quantity, 2);
        existing.totalBaseCost = round(existing.totalBaseCost + item.baseCost, 2);
        existing.totalTransportCost = round(existing.totalTransportCost + item.transportCost, 2);
        existing.totalTaxCost = round(existing.totalTaxCost + item.taxCost, 2);
        existing.totalCost = round(existing.totalCost + item.totalCost, 2);
      } else {
        consolidatedMap.set(key, {
          materialName: item.materialName,
          totalQuantity: round(item.quantity, 2),
          unit: item.unit,
          totalBaseCost: round(item.baseCost, 2),
          totalTransportCost: round(item.transportCost, 2),
          totalTaxCost: round(item.taxCost, 2),
          totalCost: round(item.totalCost, 2),
        });
      }
    }
  }

  const consolidatedMaterials = Array.from(consolidatedMap.values());
  const totalMaterialCost = consolidatedMaterials.reduce((acc, m) => acc + m.totalCost, 0);
  totalEstimateCost = round(totalMaterialCost, 2);
  const grandTotal = round(totalEstimateCost + totalLabourCost, 2);

  // Actual Consumption Comparison
  let actualConsumptionComparison: ProjectBOQEstimate['actualConsumptionComparison'];

  if (actualMaterialsOnSite && actualMaterialsOnSite.length > 0) {
    actualConsumptionComparison = consolidatedMaterials.map(est => {
      // Find matching actual material by name prefix or substring
      const matched = actualMaterialsOnSite.find(act =>
        act.name.toLowerCase().includes(est.materialName.toLowerCase()) ||
        est.materialName.toLowerCase().includes(act.name.toLowerCase())
      );

      const actualQty = matched ? matched.quantityUsed : 0;
      const varianceQty = round(actualQty - est.totalQuantity, 2);
      const variancePercent = est.totalQuantity > 0 ? round((varianceQty / est.totalQuantity) * 100, 1) : 0;

      let status: 'under' | 'on_track' | 'exceeded' = 'on_track';
      if (variancePercent > 5) {
        status = 'exceeded';
      } else if (variancePercent < -5) {
        status = 'under';
      }

      return {
        materialName: est.materialName,
        estimatedQty: est.totalQuantity,
        actualUsedQty: actualQty,
        varianceQty,
        variancePercent,
        status,
      };
    });
  }

  return {
    id: `boq_${Date.now()}`,
    userId: 'current_user',
    siteId,
    siteName,
    projectName: projectName || 'Consolidated Project BOQ',
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    calculationIds,
    consolidatedMaterials,
    totalEstimateCost,
    totalLabourCost,
    grandTotal,
    actualConsumptionComparison,
  };
}

