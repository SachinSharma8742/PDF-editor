/**
 * Groq API Client
 * Uses Llama 3.3 70B via Groq's free REST API.
 * Key is read from VITE_GROQ_API_KEY env variable.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

export function isGeminiAvailable(): boolean {
    return !!API_KEY && API_KEY.length > 10;
}

/**
 * Send a prompt to Groq and return the text response.
 * Throws on network / API errors.
 */
export async function askGemini(prompt: string): Promise<string> {
    if (!API_KEY) throw new Error('Groq API key not configured.');

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('Groq returned an empty response.');
    return text.trim();
}

/** Build a Q&A prompt */
export function buildQAPrompt(documentText: string, question: string): string {
    const trimmed = documentText.slice(0, 30000);
    return `You are a document analyst. Answer the user's question based ONLY on the document content provided below.
If the answer is not in the document, say so clearly. Be concise and direct.

---DOCUMENT START---
${trimmed}
---DOCUMENT END---

Question: ${question}

Answer:`;
}

/** Build a summary prompt based on mode */
export function buildSummaryPrompt(documentText: string, mode: string): string {
    const trimmed = documentText.slice(0, 30000);

    const modeInstructions: Record<string, string> = {
        executive: 'Write a concise executive summary (3-5 sentences) covering the main purpose, key parties, and primary obligations.',
        bullet: 'Extract the most important points as a bullet list (8-12 bullets). Start each bullet with •',
        risk: 'Identify and list all risk factors, liabilities, penalties, or concerning clauses. Rate overall risk as LOW / MEDIUM / HIGH.',
        dates: 'Extract all dates, deadlines, and time periods mentioned. Format each as: 📅 [date/period] — [context]',
        amounts: 'Extract all monetary amounts, fees, penalties, and percentages. Format each as: 💰 [amount] — [context]',
    };

    const instruction = modeInstructions[mode] ?? modeInstructions.executive;

    return `You are a document analyst. Analyze the document below and ${instruction}
Respond ONLY with the requested content — no preamble, no meta-commentary.

---DOCUMENT START---
${trimmed}
---DOCUMENT END---`;
}
