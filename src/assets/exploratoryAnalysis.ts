/**
 * Phase 2: Deep Exploratory Analysis Engine
 *
 * Implements statistical utilities to perform deep exploratory data analysis on 
 * sanitized SEO rank and audit telemetry:
 * 1. Pearson Correlation Matrix calculation across numerical vectors.
 * 2. Categorical Segmentation and Aggregation against business metrics.
 * 3. Statistical Anomaly & Trend Shift detection.
 */

import type { CleanedSEORecord } from "./dataCleaner";

export interface SegmentSummary {
  category: string;
  metric: string;
  count: number;
  average: number;
  min: number;
  max: number;
}

export interface StatisticalAnomaly {
  id: string;
  metric: string;
  value: number;
  deviation: number; // In terms of standard deviation from mean
  significance: "High" | "Medium" | "Low";
  description: string;
}

/**
 * Computes the Pearson Correlation Coefficient (r) between two numerical arrays.
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

/**
 * Generates a full correlation matrix for all numerical variables in CleanedSEORecord.
 */
export function generateCorrelationMatrix(data: CleanedSEORecord[]): Record<string, Record<string, number>> {
  const fields: (keyof CleanedSEORecord)[] = ["loadTime", "pageSize", "overallScore", "currentPosition"];
  const matrix: Record<string, Record<string, number>> = {};

  fields.forEach((f1) => {
    matrix[f1] = {};
    fields.forEach((f2) => {
      // Filter out null rankings for correlation calculations
      const pairs = data
        .map(r => {
          const v1 = r[f1];
          const v2 = r[f2];
          return { v1, v2 };
        })
        .filter(p => p.v1 !== null && p.v2 !== null) as { v1: number; v2: number }[];

      const x = pairs.map(p => p.v1);
      const y = pairs.map(p => p.v2);

      matrix[f1][f2] = parseFloat(calculatePearsonCorrelation(x, y).toFixed(3));
    });
  });

  return matrix;
}

/**
 * Segments and groups data based on a categorical key, summarizing a numerical metric.
 */
export function segmentCategoricalData(
  data: CleanedSEORecord[],
  categoryKey: "domain" | "keyword",
  metricKey: "loadTime" | "pageSize" | "overallScore" | "currentPosition"
): SegmentSummary[] {
  const groups: Record<string, number[]> = {};

  data.forEach((r) => {
    const category = r[categoryKey];
    const val = r[metricKey];
    if (val === null) return; // Skip null rankings for summary stats

    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(val);
  });

  return Object.entries(groups).map(([category, values]) => {
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = parseFloat((sum / count).toFixed(2));
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      category,
      metric: metricKey,
      count,
      average,
      min,
      max
    };
  });
}

/**
 * Identifies and reports the top 3 statistically significant anomalies in the dataset.
 */
export function detectAnomalies(data: CleanedSEORecord[]): StatisticalAnomaly[] {
  const anomalies: StatisticalAnomaly[] = [];

  // 1. Check Load Time Anomalies
  const loadTimes = data.map(r => r.loadTime);
  const meanLoad = loadTimes.reduce((a, b) => a + b, 0) / Math.max(1, loadTimes.length);
  const varLoad = loadTimes.reduce((acc, v) => acc + Math.pow(v - meanLoad, 2), 0) / Math.max(1, loadTimes.length - 1);
  const stdDevLoad = Math.sqrt(varLoad);

  data.forEach((r) => {
    if (stdDevLoad > 0) {
      const dev = (r.loadTime - meanLoad) / stdDevLoad;
      if (Math.abs(dev) > 1.8) { // Tag deviations > 1.8 std devs in small batches
        anomalies.push({
          id: r.id,
          metric: "loadTime",
          value: r.loadTime,
          deviation: parseFloat(dev.toFixed(2)),
          significance: Math.abs(dev) > 2.5 ? "High" : "Medium",
          description: `Load time of ${r.loadTime}ms deviates significantly from average (${Math.round(meanLoad)}ms).`
        });
      }
    }
  });

  // 2. Check Page Size vs Score Disconnects (e.g. Small page size but extremely poor overall SEO score)
  data.forEach((r) => {
    if (r.pageSize < 500000 && r.overallScore < 60) {
      anomalies.push({
        id: r.id,
        metric: "overallScore",
        value: r.overallScore,
        deviation: 2.0,
        significance: "High",
        description: `Critical SEO score drop (${r.overallScore}) on a lightweight document (${Math.round(r.pageSize / 1024)}KB). Potential crawl block or empty response.`
      });
    }
  });

  // Sort anomalies by deviation magnitude and return top 3
  return anomalies
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 3);
}
