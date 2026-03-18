import { useState, useCallback } from 'react';

const STORAGE_KEY = 'pdf-editor-search-history';
const MAX_HISTORY = 20;

export interface SearchHistoryEntry {
    term: string;
    timestamp: number;
    resultCount?: number;
}

export function useSearchHistory() {
    const [history, setHistory] = useState<SearchHistoryEntry[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? (JSON.parse(stored) as SearchHistoryEntry[]) : [];
        } catch {
            return [];
        }
    });

    const addEntry = useCallback((term: string, resultCount?: number) => {
        if (!term.trim()) return;
        setHistory((prev) => {
            const entry: SearchHistoryEntry = { term, timestamp: Date.now(), resultCount };
            const filtered = prev.filter((h) => h.term !== term);
            const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch {
                // Ignore storage errors
            }
            return updated;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore
        }
    }, []);

    const removeEntry = useCallback((term: string) => {
        setHistory((prev) => {
            const updated = prev.filter((h) => h.term !== term);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch {
                // Ignore
            }
            return updated;
        });
    }, []);

    return { history, addEntry, clearHistory, removeEntry };
}
