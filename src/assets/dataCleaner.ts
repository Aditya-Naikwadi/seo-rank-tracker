/**
 * Phase 1: Data Audit, Sanitization & Noise Reduction Engine
 *
 * Provides a production-ready data cleaning implementation to systematically:
 * 1. Deduplicate records based on critical unique identifiers.
 * 2. Strip high-cardinality system metadata columns (e.g., database hex IDs, raw session hashes).
 * 3. Impute missing numerical fields (median) and categorical fields (mode) in a context-aware manner.
 * 4. Filter and flag statistical anomalies (outliers) using Z-score calculation: z = (x - mean) / stdDev.
 */

export interface RawSEORecord {
  id?: string;
  systemHexId?: string;
  rawTimestamp?: string;
  keyword?: string;
  domain?: string;
  loadTime?: number;       // Expects ms (can have missing/NaN/outlier values)
  pageSize?: number;       // Expects bytes
  overallScore?: number;   // 0-100 scale
  currentPosition?: number | null;
}

export interface CleanedSEORecord {
  id: string;
  keyword: string;
  domain: string;
  loadTime: number;
  pageSize: number;
  overallScore: number;
  currentPosition: number | null;
}

export interface DataCleanseAuditLog {
  initialCount: number;
  deduplicatedCount: number;
  droppedMissingIdCount: number;
  imputedLoadTimeCount: number;
  imputedPageSizeCount: number;
  imputedKeywordCount: number;
  outliersDetected: {
    recordId: string;
    field: string;
    value: number;
    zScore: number;
    type: "systemic_anomaly" | "pure_noise";
  }[];
  finalCount: number;
}

/**
 * Calculates standard deviation
 */
function getStandardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculates median value for a list of numbers
 */
function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return (sorted[half - 1] + sorted[half]) / 2;
}

/**
 * Calculates mode value for a list of strings
 */
function getMode(values: string[]): string {
  if (values.length === 0) return "unknown";
  const frequency: Record<string, number> = {};
  let maxFreq = 0;
  let mode = values[0];

  values.forEach((val) => {
    frequency[val] = (frequency[val] || 0) + 1;
    if (frequency[val] > maxFreq) {
      maxFreq = frequency[val];
      mode = val;
    }
  });

  return mode;
}

/**
 * Executes the complete Phase 1 Data Sanitization & Noise Reduction Pipeline
 */
export function cleanSeoTelemetryData(
  rawData: RawSEORecord[]
): { cleanedData: CleanedSEORecord[]; auditLog: DataCleanseAuditLog } {
  
  const auditLog: DataCleanseAuditLog = {
    initialCount: rawData.length,
    deduplicatedCount: 0,
    droppedMissingIdCount: 0,
    imputedLoadTimeCount: 0,
    imputedPageSizeCount: 0,
    imputedKeywordCount: 0,
    outliersDetected: [],
    finalCount: 0
  };

  // --- Step 1: Handle Missing Unique Identifiers & Deduplication ---
  const uniqueIds = new Set<string>();
  const preCleanedRecords: RawSEORecord[] = [];

  rawData.forEach((record) => {
    if (!record.id) {
      auditLog.droppedMissingIdCount++;
      return; // Drop rows missing critical unique identifiers
    }

    if (uniqueIds.has(record.id)) {
      auditLog.deduplicatedCount++;
      return; // Purge duplicate records
    }

    uniqueIds.add(record.id);
    preCleanedRecords.push(record);
  });

  // --- Step 2: Context-Aware Missing Value Imputation ---
  // Extract non-null values for baseline calculation
  const validLoadTimes = preCleanedRecords.map(r => r.loadTime).filter((v): v is number => typeof v === "number" && !isNaN(v));
  const validPageSizes = preCleanedRecords.map(r => r.pageSize).filter((v): v is number => typeof v === "number" && !isNaN(v));
  const validKeywords = preCleanedRecords.map(r => r.keyword).filter((v): v is string => typeof v === "string" && v !== "");

  const medianLoadTime = getMedian(validLoadTimes) || 1500; // Default fallback to 1.5s
  const medianPageSize = getMedian(validPageSizes) || 1200000; // Default fallback to 1.2MB
  const modeKeyword = getMode(validKeywords) || "seo rank tracker";

  const imputedRecords: CleanedSEORecord[] = preCleanedRecords.map((r) => {
    let loadTime = r.loadTime;
    let pageSize = r.pageSize;
    let keyword = r.keyword;

    if (loadTime === undefined || isNaN(loadTime)) {
      loadTime = medianLoadTime;
      auditLog.imputedLoadTimeCount++;
    }

    if (pageSize === undefined || isNaN(pageSize)) {
      pageSize = medianPageSize;
      auditLog.imputedPageSizeCount++;
    }

    if (keyword === undefined || keyword === "") {
      keyword = modeKeyword;
      auditLog.imputedKeywordCount++;
    }

    return {
      id: r.id!,
      keyword,
      domain: r.domain || "unknown.com",
      loadTime,
      pageSize,
      overallScore: r.overallScore || 70,
      currentPosition: r.currentPosition !== undefined ? r.currentPosition : null
    };
  });

  // --- Step 3: Outlier Management via Z-Score ---
  // Calculate stats for Z-score on Load Time
  const loadTimes = imputedRecords.map(r => r.loadTime);
  const meanLoadTime = loadTimes.reduce((acc, v) => acc + v, 0) / Math.max(1, loadTimes.length);
  const stdDevLoadTime = getStandardDeviation(loadTimes, meanLoadTime);

  // Calculate stats for Z-score on Page Size
  const pageSizes = imputedRecords.map(r => r.pageSize);
  const meanPageSize = pageSizes.reduce((acc, v) => acc + v, 0) / Math.max(1, pageSizes.length);
  const stdDevPageSize = getStandardDeviation(pageSizes, meanPageSize);

  const cleanedData: CleanedSEORecord[] = [];

  imputedRecords.forEach((r) => {
    let hasOutlier = false;

    // Check Load Time Outliers (z-score > 3)
    if (stdDevLoadTime > 0) {
      const zLoad = (r.loadTime - meanLoadTime) / stdDevLoadTime;
      if (Math.abs(zLoad) > 3) {
        hasOutlier = true;
        auditLog.outliersDetected.push({
          recordId: r.id,
          field: "loadTime",
          value: r.loadTime,
          zScore: parseFloat(zLoad.toFixed(2)),
          type: r.loadTime > 30000 ? "systemic_anomaly" : "pure_noise" // Over 30s is socket timeout
        });
      }
    }

    // Check Page Size Outliers (z-score > 3)
    if (stdDevPageSize > 0) {
      const zSize = (r.pageSize - meanPageSize) / stdDevPageSize;
      if (Math.abs(zSize) > 3) {
        hasOutlier = true;
        auditLog.outliersDetected.push({
          recordId: r.id,
          field: "pageSize",
          value: r.pageSize,
          zScore: parseFloat(zSize.toFixed(2)),
          type: r.pageSize > 20000000 ? "systemic_anomaly" : "pure_noise" // Exceeds 20MB is massive resource leak
        });
      }
    }

    // Outlier Handling Strategy: Filter outliers from analytics datasets
    if (!hasOutlier) {
      cleanedData.push(r);
    }
  });

  auditLog.finalCount = cleanedData.length;

  return {
    cleanedData,
    auditLog
  };
}
