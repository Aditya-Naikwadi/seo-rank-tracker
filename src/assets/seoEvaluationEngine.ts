/**
 * Algorithmic SEO Evaluation & Fair Analytics Engine
 *
 * Implements the mathematical and structural framework to calculate
 * the Algorithmic Fairness Score (AFS) based on target document,
 * competitor matrix, and page experience telemetry.
 * 
 * Formula:
 * AFS = (w1 * S_intent + w2 * S_EEAT + w3 * S_UX + w4 * S_topical) - Sum(P_spam)
 */

export type CoreIntent = "Informational" | "Transactional" | "Navigational" | "Commercial";

export interface DocumentStructure {
  title: string;
  metaDescription: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  bodyCopy: string;
  authorObjectSchema?: {
    name: string;
    type: string;
    sameAs?: string[];
  };
}

export interface CompetitorDocSummary {
  domain: string;
  title: string;
  intent: CoreIntent;
  wordCount: number;
  headingsCount: number;
  eeatScore: number; // 0-100 normalized
  lcp: number;       // Largest Contentful Paint (seconds)
  cls: number;       // Cumulative Layout Shift
}

export interface TechnicalHealthVectors {
  lcp: number; // in seconds
  inp: number; // in milliseconds
  cls: number;
}

export interface EvaluationInput {
  targetKeyword: string;
  baselineIntent: CoreIntent;
  targetDoc: DocumentStructure;
  competitors: CompetitorDocSummary[];
  techHealth: TechnicalHealthVectors;
  geographicConstraint: string;
}

export interface SEOEvaluationResult {
  unbiased_seo_health_score: number;       // 0-100
  intent_alignment_rating: number;         // 0.0-1.0
  topical_coverage_gap: string[];
  eeat_trust_index: "Low" | "Medium" | "High";
  technical_bottleneck_detected: boolean;
  compliance_status: "Pass" | "Fail";
  compliance_reason?: string;
}

/**
 * Calculates semantic coverage gaps between target body copy and competitor matrices
 */
function calculateTopicalGaps(body: string, competitors: CompetitorDocSummary[]): string[] {
  const commonEntities = ["API", "Integration", "Security", "Fees", "Documentation", "Payouts", "Compliance"];
  const gaps: string[] = [];
  const lowerBody = body.toLowerCase();

  // If we don't have competitor data, assume no gaps
  if (!competitors || competitors.length === 0) return [];

  // For each common entity, check if it's missing in target copy but likely present in competitors
  commonEntities.forEach((entity) => {
    if (!lowerBody.includes(entity.toLowerCase())) {
      gaps.push(entity);
    }
  });

  return gaps;
}

/**
 * Main Evaluation Engine Function
 */
export function evaluateSeoFairness(input: EvaluationInput): SEOEvaluationResult {
  const w1 = 0.35; // Intent Match Accuracy
  const w2 = 0.30; // E-E-A-T Programmatic Vector
  const w3 = 0.20; // Page Experience Realization
  const w4 = 0.15; // Topical Cohesion Margin

  let sIntent = 0;
  let sEEAT = 0;
  let sUX = 0;

  const complianceReasons: string[] = [];

  // 1. Intent Match Accuracy (35%)
  const hasAuthorSchema = !!input.targetDoc.authorObjectSchema;
  const wordCount = input.targetDoc.bodyCopy.split(/\s+/).filter(Boolean).length;
  
  // High-level intent deduction
  if (input.baselineIntent === "Informational") {
    // Informational expects long-form depth and attribution
    if (wordCount > 1000) sIntent += 70;
    else if (wordCount > 500) sIntent += 40;
    else sIntent += 10;

    if (hasAuthorSchema) sIntent += 30;
  } else if (input.baselineIntent === "Transactional") {
    // Transactional expects concise conversion-focused copy
    if (wordCount > 200 && wordCount < 800) sIntent += 80;
    else sIntent += 40;
    sIntent += 20; // Default transactional boost
  } else {
    sIntent = 85; // Baseline default match for other intents
  }
  sIntent = Math.min(100, sIntent);

  // 2. E-E-A-T Trust Vector (30%)
  if (hasAuthorSchema) sEEAT += 40;
  if (input.targetDoc.bodyCopy.includes("case study") || input.targetDoc.bodyCopy.includes("first-hand")) sEEAT += 30;
  if (input.targetDoc.headings.h2.length > 2) sEEAT += 20;
  if (input.targetDoc.metaDescription.length > 120) sEEAT += 10;
  sEEAT = Math.min(100, sEEAT);

  // 3. UX / Page Experience Realization (20%)
  // LCP < 2.5s, CLS < 0.1
  const isLcpHealthy = input.techHealth.lcp < 2.5;
  const isClsHealthy = input.techHealth.cls < 0.1;
  const isInpHealthy = input.techHealth.inp < 200;

  if (isLcpHealthy) sUX += 40;
  else sUX += Math.max(0, 40 - (input.techHealth.lcp - 2.5) * 10);

  if (isClsHealthy) sUX += 40;
  if (isInpHealthy) sUX += 20;
  sUX = Math.min(100, sUX);

  // 4. Topical Cohesion Margin (15%)
  const topicalGaps = calculateTopicalGaps(input.targetDoc.bodyCopy, input.competitors);
  const sTopical = Math.max(0, 100 - (topicalGaps.length * 15));

  // Compute Base AFS
  let afs = (w1 * sIntent) + (w2 * sEEAT) + (w3 * sUX) + (w4 * sTopical);

  // 5. Spam and Penalty Filtering
  // Keyword Stuffing (Density Check)
  const kw = input.targetKeyword.toLowerCase();
  const kwCount = (input.targetDoc.bodyCopy.toLowerCase().split(kw).length - 1);
  const kwDensity = kwCount / Math.max(1, wordCount);
  
  let keywordStuffingPenalty = 0;
  if (kwDensity > 0.055) { // Exceeds 5.5% density
    keywordStuffingPenalty = 25;
    complianceReasons.push("Keyword stuffing detected (density exceeds 5.5%)");
  }

  // Thin / Scaled Content check
  let isThinContent = false;
  if (wordCount < 250 && topicalGaps.length > 4) {
    isThinContent = true;
    complianceReasons.push("Thin/scaled content flag triggered (low topical density and word count)");
  }

  // Apply calculations
  afs = Math.max(0, afs - keywordStuffingPenalty);

  if (isThinContent) {
    afs = Math.min(40, afs);
  }

  // Final Trust Level Mapping
  let eeatTrustIndex: "Low" | "Medium" | "High" = "Medium";
  if (sEEAT >= 80) eeatTrustIndex = "High";
  else if (sEEAT < 45) eeatTrustIndex = "Low";

  // Compliance Status Checks
  const technicalBottleneckDetected = !isLcpHealthy || !isClsHealthy || !isInpHealthy;
  if (technicalBottleneckDetected) {
    if (!isLcpHealthy) complianceReasons.push(`LCP bottleneck (${input.techHealth.lcp}s > 2.5s)`);
    if (!isClsHealthy) complianceReasons.push(`CLS bottleneck (${input.techHealth.cls} > 0.1)`);
  }

  const complianceStatus = complianceReasons.length === 0 ? "Pass" : "Fail";

  return {
    unbiased_seo_health_score: Math.round(afs),
    intent_alignment_rating: parseFloat((sIntent / 100).toFixed(2)),
    topical_coverage_gap: topicalGaps,
    eeat_trust_index: eeatTrustIndex,
    technical_bottleneck_detected: technicalBottleneckDetected,
    compliance_status: complianceStatus,
    ...(complianceReasons.length > 0 ? { compliance_reason: complianceReasons.join("; ") } : {})
  };
}
