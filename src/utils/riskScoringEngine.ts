/**
 * Contract Risk Scoring Engine
 *
 * Evaluates document risk profile based on clause detection output.
 * Produces a structured risk report with weighted scoring.
 *
 * Risk Categories:
 *   - Unbalanced liability terms
 *   - Missing termination protections
 *   - Broad indemnity clauses
 *   - Payment ambiguity
 *   - Undefined obligations
 *   - Auto-renewal traps
 *
 * Non-destructive — operates on extracted text only.
 */

import { detectClauses, type ClauseAnalysisResult, type DetectedClause } from './clauseDetection';

// ─── Types ─────────────────────────────────────────────────────

export interface RiskCategory {
    id: string;
    name: string;
    description: string;
    /** Weight multiplier for overall score (0-1) */
    weight: number;
    /** Color for UI */
    color: string;
    /** Icon emoji */
    icon: string;
}

export interface RiskFlag {
    /** Which risk category */
    category: RiskCategory;
    /** Severity (0-1) */
    severity: number;
    /** Human-readable reasoning */
    reasoning: string;
    /** Related clause matches, if any */
    relatedClauses: DetectedClause[];
    /** Text snippet triggering the flag */
    evidence: string;
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RiskReport {
    /** Overall risk score (0-100) */
    overallScore: number;
    /** Risk level classification */
    level: RiskLevel;
    /** Individual risk flags */
    flags: RiskFlag[];
    /** Clause analysis used as input */
    clauseAnalysis: ClauseAnalysisResult;
    /** Summary text */
    summary: string;
    /** Processing time in ms */
    durationMs: number;
    /** Timestamp */
    generatedAt: string;
}

export interface RiskWeightProfile {
    name: string;
    weights: Record<string, number>;
}

// ─── Built-in Risk Categories ──────────────────────────────────

const RISK_CATEGORIES: RiskCategory[] = [
    {
        id: 'unbalanced-liability',
        name: 'Unbalanced Liability',
        description: 'One-sided liability terms that disproportionately favor one party',
        weight: 0.2,
        color: '#ef4444',
        icon: '⚖️',
    },
    {
        id: 'missing-termination',
        name: 'Missing Termination Protection',
        description: 'Lack of clear termination rights or notice periods',
        weight: 0.18,
        color: '#f97316',
        icon: '🚪',
    },
    {
        id: 'broad-indemnity',
        name: 'Broad Indemnity',
        description: 'Overly broad indemnification obligations',
        weight: 0.15,
        color: '#ec4899',
        icon: '🛡️',
    },
    {
        id: 'payment-ambiguity',
        name: 'Payment Ambiguity',
        description: 'Unclear payment terms, schedules, or conditions',
        weight: 0.15,
        color: '#10b981',
        icon: '💸',
    },
    {
        id: 'undefined-obligations',
        name: 'Undefined Obligations',
        description: 'Vague or undefined performance obligations',
        weight: 0.12,
        color: '#8b5cf6',
        icon: '📋',
    },
    {
        id: 'auto-renewal-trap',
        name: 'Auto-Renewal Trap',
        description: 'Automatic renewal with difficult opt-out conditions',
        weight: 0.1,
        color: '#06b6d4',
        icon: '🔄',
    },
    {
        id: 'missing-confidentiality',
        name: 'Weak Confidentiality',
        description: 'Missing or insufficient confidentiality protections',
        weight: 0.05,
        color: '#a855f7',
        icon: '🔒',
    },
    {
        id: 'missing-dispute',
        name: 'No Dispute Resolution',
        description: 'Absence of dispute resolution or governing law clause',
        weight: 0.05,
        color: '#3b82f6',
        icon: '⚠️',
    },
];

// ─── Risk Scoring Rules ────────────────────────────────────────

interface RiskRule {
    categoryId: string;
    /** Evaluate against clause results and full text */
    evaluate: (clauses: ClauseAnalysisResult, fullText: string) => { severity: number; reasoning: string; evidence: string } | null;
}

const RISK_RULES: RiskRule[] = [
    {
        categoryId: 'unbalanced-liability',
        evaluate: (clauses, text) => {
            const liabilityClauses = clauses.clauses.filter(c => c.pattern.id === 'liability');
            if (liabilityClauses.length === 0) return null;
            // Check for one-sided language
            const oneSided = [
                /shall\s+not\s+be\s+liable\s+for\s+any/i,
                /in\s+no\s+event\s+shall\s+.{0,40}\s+exceed/i,
                /disclaims?\s+all\s+(warranties|liability)/i,
                /as[\s-]?is/i,
            ];

            let hits = 0;
            for (const pat of oneSided) {
                if (pat.test(text)) hits++;
            }

            if (hits === 0) return null;

            const severity = Math.min(0.3 + hits * 0.2, 1);
            return {
                severity,
                reasoning: `Found ${hits} indicator(s) of one-sided liability language. ${hits >= 3 ? 'Multiple disclaimers suggest significantly unbalanced terms.' : 'Review liability section carefully.'}`,
                evidence: liabilityClauses[0].matchedText.slice(0, 200),
            };
        },
    },
    {
        categoryId: 'missing-termination',
        evaluate: (clauses) => {
            const termClauses = clauses.clauses.filter(c => c.pattern.id === 'termination');
            if (termClauses.length > 0) {
                // Check if termination notice period is specified
                const hasNoticePeriod = termClauses.some(c =>
                    /\d+\s*(days?|months?|weeks?)\s*(prior\s+)?notice/i.test(c.matchedText)
                );
                if (hasNoticePeriod) return null;

                return {
                    severity: 0.5,
                    reasoning: 'Termination clause found but no specific notice period defined.',
                    evidence: termClauses[0].matchedText.slice(0, 200),
                };
            }

            return {
                severity: 0.8,
                reasoning: 'No termination clause detected. This may leave parties without a clear exit strategy.',
                evidence: '',
            };
        },
    },
    {
        categoryId: 'broad-indemnity',
        evaluate: (clauses, text) => {
            const indemnityClauses = clauses.clauses.filter(c => c.pattern.id === 'indemnification');
            if (indemnityClauses.length === 0) return null;

            const broadPatterns = [
                /indemnif(y|ication)\s+.{0,60}(all|any|every)\s+(claims?|damages?|losses?|costs?)/i,
                /hold\s+harmless\s+.{0,40}(all|any)\s/i,
                /unlimited\s+(liability|indemnif)/i,
            ];

            let broadHits = 0;
            for (const pat of broadPatterns) {
                if (pat.test(text)) broadHits++;
            }

            if (broadHits === 0) return null;

            return {
                severity: Math.min(0.4 + broadHits * 0.2, 1),
                reasoning: `Indemnification language appears overly broad with ${broadHits} indicator(s) of unlimited or sweeping obligations.`,
                evidence: indemnityClauses[0].matchedText.slice(0, 200),
            };
        },
    },
    {
        categoryId: 'payment-ambiguity',
        evaluate: (clauses, text) => {
            const paymentClauses = clauses.clauses.filter(c => c.pattern.id === 'payment-terms');
            if (paymentClauses.length > 0) {
                // Check for specific amounts or schedules
                const hasSpecifics = paymentClauses.some(c =>
                    /\$[\d,]+|\bnet\s+\d+\b|\bwithin\s+\d+\s+days?\b/i.test(c.matchedText)
                );
                if (hasSpecifics) return null;

                return {
                    severity: 0.5,
                    reasoning: 'Payment clause found but lacks specific amounts, schedules, or due dates.',
                    evidence: paymentClauses[0].matchedText.slice(0, 200),
                };
            }

            // Check if there are monetary references at all
            const hasMoney = /\$[\d,]+|payment|invoice|fee|compensation/i.test(text);
            if (hasMoney) {
                return {
                    severity: 0.6,
                    reasoning: 'Document references payments but has no structured payment terms clause.',
                    evidence: '',
                };
            }

            return null;
        },
    },
    {
        categoryId: 'undefined-obligations',
        evaluate: (clauses, text) => {
            const vaguePatterns = [
                /\b(reasonable\s+efforts?|best\s+efforts?|commercially\s+reasonable)\b/gi,
                /\b(as\s+needed|from\s+time\s+to\s+time|as\s+appropriate)\b/gi,
                /\b(may\s+include|including\s+but\s+not\s+limited\s+to)\b/gi,
            ];

            let vagueCount = 0;
            for (const pat of vaguePatterns) {
                const matches = text.match(pat);
                if (matches) vagueCount += matches.length;
            }

            if (vagueCount < 3) return null;

            return {
                severity: Math.min(0.2 + vagueCount * 0.05, 0.9),
                reasoning: `Found ${vagueCount} instances of vague obligation language. This may create ambiguity about expected performance.`,
                evidence: '',
            };
        },
    },
    {
        categoryId: 'auto-renewal-trap',
        evaluate: (clauses, text) => {
            const renewalClauses = clauses.clauses.filter(c => c.pattern.id === 'renewal');
            if (renewalClauses.length === 0) return null;

            const trapPatterns = [
                /auto(matically)?\s*[\s-]?renew/i,
                /unless\s+(written\s+)?notice\s+(is\s+)?given\s+\d+\s+(days?|months?)\s+(prior|before)/i,
                /shall\s+(automatically\s+)?continue\s+for\s+successive/i,
            ];

            let trapHits = 0;
            for (const pat of trapPatterns) {
                if (pat.test(text)) trapHits++;
            }

            if (trapHits < 2) return null;

            return {
                severity: Math.min(0.4 + trapHits * 0.15, 0.9),
                reasoning: `Auto-renewal with ${trapHits} trap indicators. Review notice requirements to avoid unwanted renewals.`,
                evidence: renewalClauses[0].matchedText.slice(0, 200),
            };
        },
    },
    {
        categoryId: 'missing-confidentiality',
        evaluate: (clauses) => {
            const confClauses = clauses.clauses.filter(c => c.pattern.id === 'confidentiality');
            if (confClauses.length > 0) return null;

            return {
                severity: 0.4,
                reasoning: 'No confidentiality clause detected. Sensitive information may lack contractual protection.',
                evidence: '',
            };
        },
    },
    {
        categoryId: 'missing-dispute',
        evaluate: (clauses) => {
            const lawClauses = clauses.clauses.filter(c => c.pattern.id === 'governing-law');
            if (lawClauses.length > 0) return null;

            return {
                severity: 0.5,
                reasoning: 'No governing law or dispute resolution clause found. This can complicate legal proceedings.',
                evidence: '',
            };
        },
    },
];

// ─── Custom weight profiles ───────────────────────────────────

let activeWeightOverrides: Record<string, number> = {};

/**
 * Set custom weight overrides for risk categories.
 */
export function setWeightProfile(profile: RiskWeightProfile): void {
    activeWeightOverrides = { ...profile.weights };
}

/**
 * Clear custom weight overrides.
 */
export function clearWeightProfile(): void {
    activeWeightOverrides = {};
}

// ─── Main Scoring Function ────────────────────────────────────

function getWeight(categoryId: string): number {
    if (activeWeightOverrides[categoryId] !== undefined) {
        return activeWeightOverrides[categoryId];
    }
    const cat = RISK_CATEGORIES.find(c => c.id === categoryId);
    return cat?.weight ?? 0.1;
}

function classifyLevel(score: number): RiskLevel {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'moderate';
    return 'low';
}

function generateSummary(level: RiskLevel, flags: RiskFlag[]): string {
    const count = flags.length;
    switch (level) {
        case 'critical':
            return `CRITICAL RISK: ${count} risk factor${count !== 1 ? 's' : ''} identified. This document contains significant contractual risks requiring immediate legal review.`;
        case 'high':
            return `HIGH RISK: ${count} risk factor${count !== 1 ? 's' : ''} identified. Several concerning terms detected that warrant careful review.`;
        case 'moderate':
            return `MODERATE RISK: ${count} risk factor${count !== 1 ? 's' : ''} identified. Some areas may benefit from negotiation or clarification.`;
        case 'low':
            return `LOW RISK: ${count > 0 ? `${count} minor concern${count !== 1 ? 's' : ''} noted` : 'No significant risk factors detected'}. Document appears relatively balanced.`;
    }
}

/**
 * Score the risk of a document.
 * Designed to be callable from the AI analysis worker.
 */
export function scoreContractRisk(fullText: string): RiskReport {
    const start = performance.now();

    // Step 1: Run clause detection
    const clauseAnalysis = detectClauses(fullText);

    // Step 2: Evaluate risk rules
    const flags: RiskFlag[] = [];

    for (const rule of RISK_RULES) {
        const category = RISK_CATEGORIES.find(c => c.id === rule.categoryId);
        if (!category) continue;

        const result = rule.evaluate(clauseAnalysis, fullText);
        if (result) {
            flags.push({
                category,
                severity: result.severity,
                reasoning: result.reasoning,
                relatedClauses: clauseAnalysis.clauses.filter(c =>
                    c.pattern.id === rule.categoryId.replace('missing-', '').replace('broad-', '').replace('unbalanced-', '').replace('auto-renewal-trap', 'renewal').replace('undefined-obligations', '') ||
                    result.evidence && c.matchedText.includes(result.evidence.slice(0, 50))
                ),
                evidence: result.evidence,
            });
        }
    }

    // Step 3: Calculate weighted score
    let weightedSum = 0;
    let totalWeight = 0;

    for (const flag of flags) {
        const weight = getWeight(flag.category.id);
        weightedSum += flag.severity * weight;
        totalWeight += weight;
    }

    // Also penalize for uncovered categories (categories with no flags get 0 contribution)
    // Normalize to 0-100 scale
    const maxPossibleWeight = RISK_CATEGORIES.reduce((sum, c) => sum + getWeight(c.id), 0);
    const overallScore = totalWeight > 0
        ? Math.round((weightedSum / maxPossibleWeight) * 100)
        : 0;

    // Sort flags by severity descending
    flags.sort((a, b) => b.severity - a.severity);

    const level = classifyLevel(overallScore);

    return {
        overallScore,
        level,
        flags,
        clauseAnalysis,
        summary: generateSummary(level, flags),
        durationMs: performance.now() - start,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Get all risk categories.
 */
export function getRiskCategories(): RiskCategory[] {
    return [...RISK_CATEGORIES];
}
