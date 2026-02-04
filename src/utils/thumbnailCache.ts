import { get, set, del, clear } from 'idb-keyval';

const CACHE_PREFIX = 'pdf-thumb-';
const CACHE_VERSION_KEY = 'pdf-thumb-version';
const CURRENT_VERSION = 1;

export interface ThumbnailCacheItem {
    blob: Blob;
    timestamp: number;
    width: number;
    pageIndex: number;
    pdfId: string; // hash or filename + size
}

export const ThumbnailCache = {
    /**
     * Generate a unique key for a specific page thumbnail
     */
    getKey: (pdfName: string, pageIndex: number, width: number) => {
        return `${CACHE_PREFIX}${pdfName}-${pageIndex}-${width}`;
    },

    /**
     * Save a thumbnail blob to the cache
     */
    save: async (key: string, blob: Blob) => {
        try {
            await set(key, {
                blob,
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('Failed to save thumbnail to cache:', error);
        }
    },

    /**
     * Retrieve a thumbnail blob from the cache
     */
    get: async (key: string): Promise<Blob | null> => {
        try {
            const data = await get(key);
            if (data && data.blob instanceof Blob) {
                return data.blob;
            }
        } catch (error) {
            console.warn('Failed to get thumbnail from cache:', error);
        }
        return null;
    },

    /**
     * Clear all cached thumbnails
     */
    clear: async () => {
        try {
            // We might want to be more selective, but for now clear logic implies
            // potentially wiping all keys or iterating. 
            // idb-keyval 'clear' wipes the whole store.
            // Be careful if sharing store. Default store is 'keyval-store'.
            await clear();
        } catch (error) {
            console.error('Failed to clear thumbnail cache:', error);
        }
    }
};
