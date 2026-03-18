/**
 * Background Removal Web Worker
 * Runs ONNX inference for U²-Net segmentation off the main thread.
 * 
 * Messages IN:
 *   { type: 'init' }                      — Pre-load the model
 *   { type: 'infer', imageData, width, height } — Run segmentation
 * 
 * Messages OUT:
 *   { type: 'progress', stage, percent }
 *   { type: 'model-loaded' }
 *   { type: 'result', maskData: Uint8ClampedArray, width, height }
 *   { type: 'error', message }
 */

const ORT_MODULE_NAME = 'onnxruntime-web';

let session: any = null;
let isLoading = false;
let ortModule: any = null;

const MODEL_INPUT_SIZE = 320;
const MODEL_URL = '/models/u2netp.onnx';

/**
 * Load the ONNX model with execution provider fallback.
 */
async function loadModel(): Promise<any> {
    if (session) return session;
    if (isLoading) {
        // Wait for existing load to complete
        while (isLoading) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (session) return session;
    }

    isLoading = true;
    postMessage({ type: 'progress', stage: 'Loading model...', percent: 10 });

    try {
        const ort = await loadOrtModule();
        if (!ort) {
            throw new Error('onnxruntime-web is not installed. Background removal is unavailable.');
        }

        // Try execution providers in priority order
        const providers = ['wasm'];

        session = await ort.InferenceSession.create(MODEL_URL, {
            executionProviders: providers,
            graphOptimizationLevel: 'all',
        });

        postMessage({ type: 'model-loaded' });
        postMessage({ type: 'progress', stage: 'Model ready', percent: 30 });
        return session;
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load model';
        throw new Error(msg);
    } finally {
        isLoading = false;
    }
}

/**
 * Preprocess image data to Float32 tensor [1, 3, 320, 320].
 * Normalizes pixel values to [0, 1].
 */
function preprocessImage(
    imageData: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number
): any {
    if (!ortModule) {
        throw new Error('onnxruntime-web is not available.');
    }

    const inputSize = MODEL_INPUT_SIZE;
    const float32Data = new Float32Array(1 * 3 * inputSize * inputSize);

    // We need to resize to 320x320 using nearest neighbor (fast)
    // OffscreenCanvas is available in workers
    const canvas = new OffscreenCanvas(inputSize, inputSize);
    const ctx = canvas.getContext('2d')!;

    // Create ImageData from input
    const srcCanvas = new OffscreenCanvas(srcWidth, srcHeight);
    const srcCtx = srcCanvas.getContext('2d')!;
    const rawData = imageData.buffer instanceof ArrayBuffer ? imageData.buffer : (imageData.buffer as unknown as ArrayBuffer);
    const imgData = new ImageData(new Uint8ClampedArray(rawData), srcWidth, srcHeight);
    srcCtx.putImageData(imgData, 0, 0);

    // Draw resized
    ctx.drawImage(srcCanvas, 0, 0, inputSize, inputSize);
    const resizedData = ctx.getImageData(0, 0, inputSize, inputSize).data;

    // Normalize to [0, 1] and arrange as CHW (channels first)
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < inputSize * inputSize; i++) {
        const r = resizedData[i * 4] / 255.0;
        const g = resizedData[i * 4 + 1] / 255.0;
        const b = resizedData[i * 4 + 2] / 255.0;

        float32Data[i] = (r - mean[0]) / std[0];                                    // R channel
        float32Data[inputSize * inputSize + i] = (g - mean[1]) / std[1];             // G channel
        float32Data[2 * inputSize * inputSize + i] = (b - mean[2]) / std[2];         // B channel
    }

    return new ortModule.Tensor('float32', float32Data, [1, 3, inputSize, inputSize]);
}

/**
 * Post-process model output to a grayscale mask at original resolution.
 * Returns Uint8ClampedArray of mask values (0–255).
 */
function postprocessMask(
    outputTensor: any,
    originalWidth: number,
    originalHeight: number
): Uint8ClampedArray {
    const data = outputTensor.data as Float32Array;
    const tensorSize = MODEL_INPUT_SIZE;

    // Normalize output to [0, 1] range
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;

    // Create mask at model resolution
    const maskCanvas = new OffscreenCanvas(tensorSize, tensorSize);
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImageData = maskCtx.createImageData(tensorSize, tensorSize);

    for (let i = 0; i < tensorSize * tensorSize; i++) {
        const val = Math.round(((data[i] - min) / range) * 255);
        maskImageData.data[i * 4] = val;
        maskImageData.data[i * 4 + 1] = val;
        maskImageData.data[i * 4 + 2] = val;
        maskImageData.data[i * 4 + 3] = 255;
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    // Upscale mask to original resolution
    const outCanvas = new OffscreenCanvas(originalWidth, originalHeight);
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);

    const result = outCtx.getImageData(0, 0, originalWidth, originalHeight);

    // Extract single-channel grayscale mask
    const grayscaleMask = new Uint8ClampedArray(originalWidth * originalHeight);
    for (let i = 0; i < grayscaleMask.length; i++) {
        grayscaleMask[i] = result.data[i * 4]; // R channel = grayscale value
    }

    return grayscaleMask;
}

/**
 * Run the full inference pipeline.
 */
async function runInference(
    imageData: Uint8ClampedArray,
    width: number,
    height: number
): Promise<{ maskData: Uint8ClampedArray; width: number; height: number }> {
    const sess = await loadModel();

    postMessage({ type: 'progress', stage: 'Preprocessing...', percent: 40 });
    const inputTensor = preprocessImage(imageData, width, height);

    postMessage({ type: 'progress', stage: 'Running inference...', percent: 50 });

    // Get the input name from the model
    const inputName = sess.inputNames[0];
    const feeds: Record<string, any> = { [inputName]: inputTensor };

    const results = await sess.run(feeds);

    postMessage({ type: 'progress', stage: 'Post-processing...', percent: 80 });

    // Get first output (u2netp outputs multiple, we want the first/main one)
    const outputName = sess.outputNames[0];
    const outputTensor = results[outputName];

    const maskData = postprocessMask(outputTensor, width, height);

    // Dispose tensors
    inputTensor.dispose();
    outputTensor.dispose();

    postMessage({ type: 'progress', stage: 'Complete', percent: 100 });

    return { maskData, width, height };
}

// Message handler
self.onmessage = async (e: MessageEvent) => {
    const { type } = e.data;

    try {
        switch (type) {
            case 'init':
                await loadModel();
                break;

            case 'infer': {
                const { imageData, width, height } = e.data;
                const result = await runInference(
                    new Uint8ClampedArray(imageData),
                    width,
                    height
                );
                // Transfer the mask data back
                const buf = result.maskData.buffer as ArrayBuffer;
                self.postMessage(
                    { type: 'result', maskData: buf, width: result.width, height: result.height },
                    { transfer: [buf] }
                );
                break;
            }

            default:
                postMessage({ type: 'error', message: `Unknown message type: ${type}` });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Worker error';
        postMessage({ type: 'error', message });
    }
};

async function loadOrtModule(): Promise<any | null> {
    if (ortModule) {
        return ortModule;
    }

    try {
        ortModule = await import(/* @vite-ignore */ ORT_MODULE_NAME);
        return ortModule;
    } catch {
        return null;
    }
}
