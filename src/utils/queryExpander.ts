/**
 * Local Query Expander + Feature Suggester
 *
 * Runs 100% locally — zero extra tokens sent to Groq.
 *
 * expandQuery:    Rewrites a vague user query into a richer, more precise one.
 * suggestFeatures: Returns matching app features based on query intent.
 */

import { APP_FEATURES, type AppFeature } from './appFeatures';

// ─── Query Expansion Map ────────────────────────────────────────
// Maps common vague words → domain-specific legal/document terms

const EXPANSION_MAP: Record<string, string[]> = {
    // Money & Finance
    money: ['payment', 'fee', 'amount', 'cost', 'charge', 'compensation', 'sum'],
    pay: ['payment', 'fee', 'invoice', 'remuneration', 'compensation'],
    cost: ['price', 'fee', 'amount', 'charge', 'expense'],
    price: ['cost', 'fee', 'amount', 'rate', 'charge'],
    paid: ['payment', 'amount', 'fee', 'compensation'],

    // Dates & Time
    end: ['termination', 'expiry', 'expiration', 'deadline', 'conclusion'],
    finish: ['termination', 'completion', 'end date', 'deadline'],
    expire: ['expiration', 'termination', 'end date', 'deadline', 'lapse'],
    deadline: ['due date', 'expiration', 'cutoff', 'final date'],
    start: ['commencement', 'effective date', 'beginning', 'inception'],
    begin: ['commencement', 'effective date', 'start date'],
    renew: ['renewal', 'extension', 'continuation', 'rollover'],

    // Parties
    who: ['party', 'parties', 'signatory', 'authorized', 'company', 'individual', 'person'],
    company: ['party', 'corporation', 'entity', 'organization', 'firm'],
    person: ['individual', 'party', 'signatory', 'representative'],

    // Obligations & Actions
    must: ['shall', 'obligation', 'required', 'mandatory', 'duty'],
    need: ['requirement', 'obligation', 'condition', 'necessary'],
    allowed: ['permitted', 'authorized', 'entitled', 'right', 'may'],
    banned: ['prohibited', 'restricted', 'forbidden', 'not permitted'],
    break: ['terminate', 'breach', 'violation', 'default', 'cancel'],
    cancel: ['termination', 'cancellation', 'rescission', 'revocation'],
    leave: ['termination', 'exit', 'withdrawal', 'notice period'],

    // Legal Terms
    penalty: ['fine', 'damage', 'liability', 'consequence', 'sanction', 'indemnity'],
    fine: ['penalty', 'fee', 'sanction', 'charge', 'damages'],
    secret: ['confidential', 'non-disclosure', 'proprietary', 'sensitive'],
    nda: ['non-disclosure', 'confidentiality', 'confidential agreement'],
    problem: ['dispute', 'conflict', 'disagreement', 'breach', 'issue'],
    fight: ['dispute', 'litigation', 'arbitration', 'conflict'],
    sue: ['litigation', 'legal action', 'lawsuit', 'damages'],
    change: ['amendment', 'modification', 'alteration', 'revision'],
    rule: ['clause', 'provision', 'term', 'condition', 'stipulation'],
    limit: ['limitation', 'restriction', 'cap', 'maximum', 'threshold'],

    // Document Parts
    clause: ['provision', 'section', 'term', 'article', 'paragraph'],
    section: ['clause', 'article', 'provision', 'paragraph', 'part'],
    agreement: ['contract', 'deed', 'arrangement', 'terms'],
};

/**
 * Expands a vague user query into a richer, more precise version.
 * The expanded query replaces the original in the Groq prompt — no extra tokens.
 */
export function expandQuery(query: string): string {
    const words = query.toLowerCase().split(/\s+/);
    const expansions = new Set<string>();

    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, '');
        if (EXPANSION_MAP[clean]) {
            EXPANSION_MAP[clean].forEach(e => expansions.add(e));
        }
    }

    if (expansions.size === 0) return query; // nothing to expand, return as-is

    // Append expanded terms in parentheses as context hints
    const hint = [...expansions].slice(0, 6).join(', ');
    return `${query} (also consider: ${hint})`;
}

/**
 * Returns matching app features based on what the user is likely trying to DO.
 * Runs locally — never sent to Groq.
 */
export function suggestFeatures(query: string): AppFeature[] {
    const q = query.toLowerCase();

    const scored = APP_FEATURES.map(feature => {
        let score = 0;
        for (const kw of feature.keywords) {
            if (q.includes(kw.toLowerCase())) score += 2;
            // partial word match
            else if (kw.toLowerCase().split(' ').some(w => q.includes(w) && w.length > 3)) score += 1;
        }
        return { feature, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2) // max 2 suggestions
        .map(s => s.feature);
}
