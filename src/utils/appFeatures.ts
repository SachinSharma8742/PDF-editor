/**
 * App Features Registry
 *
 * Edit this file to add, remove, or update features shown in the AI suggestion box.
 * Each feature has keywords — when user's question matches them, the suggestion appears.
 *
 * Format:
 *   id        — unique identifier
 *   name      — display name shown in the suggestion card
 *   icon      — emoji icon
 *   location  — where to find it in the app (shown as a path)
 *   keywords  — words matched against user query to trigger this suggestion
 *   tip       — one short actionable sentence shown in the card
 */

export interface AppFeature {
    id: string;
    name: string;
    icon: string;
    location: string;
    keywords: string[];
    tip: string;
}

export const APP_FEATURES: AppFeature[] = [
    {
        id: 'ocr',
        name: 'OCR Text Recognition',
        icon: '🔍',
        location: 'Editor Mode → Toolbar → Scan (OCR)',
        keywords: ['scan', 'scanned', 'image', 'unreadable', 'recognize', 'picture', 'photo', 'blurry', 'handwritten'],
        tip: 'Run OCR to extract text from scanned pages and make them searchable.',
    },
    {
        id: 'text-editor',
        name: 'Native Text Editor',
        icon: '✏️',
        location: 'Toolbar → Edit Text (T icon)',
        keywords: ['edit', 'change text', 'modify', 'replace text', 'correct', 'fix text', 'update text', 'retype'],
        tip: 'Click directly on any text in the PDF to edit it in place.',
    },
    {
        id: 'redaction',
        name: 'Redaction Tool',
        icon: '⬛',
        location: 'Editor Mode → Toolbar → Redact',
        keywords: ['hide', 'redact', 'remove', 'black out', 'censor', 'sensitive', 'secret', 'confidential', 'private', 'personal'],
        tip: 'Use the Redaction tool to permanently black out sensitive information.',
    },
    {
        id: 'signature',
        name: 'Signature Tool',
        icon: '✍️',
        location: 'Editor Mode → Toolbar → Signature',
        keywords: ['sign', 'signature', 'signed', 'signatory', 'execute', 'authorization', 'approval'],
        tip: 'Add your digital signature using the Signature tool in the editor.',
    },
    {
        id: 'highlight',
        name: 'Highlighter Tool',
        icon: '🖊️',
        location: 'Editor Mode → Toolbar → Highlighter',
        keywords: ['highlight', 'mark', 'annotate', 'color', 'emphasize', 'important clause', 'important section'],
        tip: 'Use the Highlighter to visually mark important clauses or sections.',
    },
    {
        id: 'search-replace',
        name: 'Search & Replace',
        icon: '🔎',
        location: 'Editor Mode → Toolbar → Search',
        keywords: ['find', 'search', 'locate', 'where is', 'look for', 'replace', 'occurrence', 'all instances'],
        tip: 'Use Search & Replace to find and update any word or phrase across all pages.',
    },
    {
        id: 'export',
        name: 'Export / Save',
        icon: '💾',
        location: 'Toolbar → Download / Export',
        keywords: ['save', 'export', 'download', 'print', 'share', 'send', 'output', 'generate pdf'],
        tip: 'Export your edited document as a PDF or image from the Toolbar.',
    },
    {
        id: 'page-operations',
        name: 'Page Operations',
        icon: '📄',
        location: 'Left Sidebar → Page Panel',
        keywords: ['page', 'delete page', 'add page', 'reorder', 'move page', 'rotate', 'split', 'merge'],
        tip: 'Manage pages — add, delete, reorder, or rotate — in the left Page Panel.',
    },
    {
        id: 'compare',
        name: 'Document Compare',
        icon: '🔀',
        location: 'Toolbar → Compare',
        keywords: ['compare', 'difference', 'diff', 'changed', 'version', 'original', 'before after', 'changes'],
        tip: 'Use Document Compare to highlight differences between two PDF versions.',
    },
    {
        id: 'stamps',
        name: 'Stamps & Watermarks',
        icon: '🏷️',
        location: 'Editor Mode → Toolbar → Stamps',
        keywords: ['stamp', 'watermark', 'draft', 'approved', 'confidential stamp', 'label', 'mark as'],
        tip: 'Add professional stamps like DRAFT, APPROVED, or CONFIDENTIAL via the Stamps tool.',
    },
    {
        id: 'summarizer',
        name: 'AI Summarizer',
        icon: '🤖',
        location: 'Right Sidebar → Summary Tab',
        keywords: ['summarize', 'overview', 'brief', 'tldr', 'key points', 'summary', 'what is this about'],
        tip: 'Switch to the Summary tab for an AI-generated overview of this document.',
    },
    {
        id: 'forms',
        name: 'Form Fields',
        icon: '📝',
        location: 'Editor Mode → Toolbar → Form',
        keywords: ['form', 'field', 'fill', 'input', 'checkbox', 'fillable', 'text field'],
        tip: 'Add fillable form fields — text inputs or checkboxes — using the Form tool.',
    },
];
