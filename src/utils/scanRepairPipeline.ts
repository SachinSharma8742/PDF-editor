/**
 * Automated Scan Repair Pipeline
 *
 * One-click repair for scanned documents. Sequentially runs:
 *   1. Auto Deskew
 *   2. Background Cleanup
 *   3. Contrast Enhancement
 *   4. Noise Reduction  (via pipeline worker)
 *   5. Edge Sharpening  (via pipeline worker)
 *
 * Each step takes a data URL and returns a data URL.
 * If any step fails, the pipeline aborts and returns the last successful output.
 * Never mutates the original image.
 */

import { deskew } from './deskew';
import { backgroundCleanup } from './backgroundCleanup';
import { colorEnhance } from './colorEnhance';

// ─── Types ─────────────────────────────────────────────────────

export interface PipelineProgress {
    stage: string;
    step: number;
    totalSteps: number;
}

export interface PipelineResult {
    /** Final repaired image data URL */
    dataUrl: string;
    /** Whether the pipeline completed all steps */
    complete: boolean;
    /** Error message if a step failed (pipeline still returns best result) */
    error?: string;
    /** Number of steps successfully completed */
    stepsCompleted: number;
}

// ─── Worker management ─────────────────────────────────────────

let workerInstance: Worker | null = null;

function getWorker(): Worker {
    if (!workerInstance) {
        workerInstance = new Worker(
            new URL('../workers/pipeline.worker.ts', import.meta.url),
            { type: 'module' }
        );
    }
    return workerInstance;
}

export function disposePipelineWorker(): void {
    if (workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
    }
}

// ─── Worker-backed operations ──────────────────────────────────

/**
 * Load a data URL into raw pixel data for worker transfer.
 */
function loadImageData(
    dataUrl: string
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({ data: imageData.data, width: canvas.width, height: canvas.height });
            canvas.width = 0;
            canvas.height = 0;
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
    });
}

/**
 * Run a worker operation and return the result as a data URL.
 */
function runWorkerOp(
    type: 'noise-reduce' | 'sharpen',
    dataUrl: string
): Promise<string> {
    return loadImageData(dataUrl).then(({ data, width, height }) => {
        return new Promise<string>((resolve, reject) => {
            const worker = getWorker();

            const handleMessage = (e: MessageEvent) => {
                const msg = e.data;
                if (msg.type === 'result' && msg.action === type) {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);

                    const refined = new Uint8ClampedArray(msg.maskData ?? msg.imageData);
                    const canvas = document.createElement('canvas');
                    canvas.width = msg.width;
                    canvas.height = msg.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
                    ctx.putImageData(new ImageData(refined, msg.width, msg.height), 0, 0);
                    const result = canvas.toDataURL('image/png');
                    canvas.width = 0;
                    canvas.height = 0;
                    resolve(result);
                } else if (msg.type === 'error') {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    reject(new Error(msg.message));
                }
            };

            const handleError = (err: ErrorEvent) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                reject(new Error(err.message || 'Worker error'));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            const buffer = data.buffer.slice(0) as ArrayBuffer;
            worker.postMessage(
                { type, imageData: buffer, width, height },
                [buffer]
            );
        });
    });
}

// ─── Pipeline steps ────────────────────────────────────────────

interface PipelineStep {
    name: string;
    execute: (src: string) => Promise<string>;
}

const PIPELINE_STEPS: PipelineStep[] = [
    { name: 'Auto Deskew', execute: deskew },
    { name: 'Background Cleanup', execute: backgroundCleanup },
    { name: 'Contrast Enhancement', execute: colorEnhance },
    { name: 'Noise Reduction', execute: (src) => runWorkerOp('noise-reduce', src) },
    { name: 'Edge Sharpening', execute: (src) => runWorkerOp('sharpen', src) },
];

// ─── Main API ──────────────────────────────────────────────────

/**
 * Run the full scan repair pipeline.
 *
 * @param imageSrc   - Source image data URL
 * @param onProgress - Optional progress callback
 * @returns Pipeline result with repaired data URL
 */
export async function runScanRepairPipeline(
    imageSrc: string,
    onProgress?: (p: PipelineProgress) => void
): Promise<PipelineResult> {
    const totalSteps = PIPELINE_STEPS.length;
    let currentSrc = imageSrc;
    let stepsCompleted = 0;

    for (let i = 0; i < totalSteps; i++) {
        const step = PIPELINE_STEPS[i];

        onProgress?.({
            stage: step.name,
            step: i + 1,
            totalSteps,
        });

        try {
            const result = await step.execute(currentSrc);

            // Validate output — must be a non-empty string
            if (!result || typeof result !== 'string') {
                throw new Error(`Step "${step.name}" returned invalid output`);
            }

            currentSrc = result;
            stepsCompleted++;
        } catch (err) {
            // Abort pipeline on failure, return best result so far
            const message = err instanceof Error ? err.message : `${step.name} failed`;
            return {
                dataUrl: currentSrc,
                complete: false,
                error: `Pipeline stopped at "${step.name}": ${message}`,
                stepsCompleted,
            };
        }
    }

    onProgress?.({ stage: 'Complete', step: totalSteps, totalSteps });

    return {
        dataUrl: currentSrc,
        complete: true,
        stepsCompleted,
    };
}
