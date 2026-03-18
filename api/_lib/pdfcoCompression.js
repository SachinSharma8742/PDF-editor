export const PDFCO_PRESETS = ['high_quality', 'balanced', 'max_compression'];

export class PdfCoRequestError extends Error {
    constructor(status, userMessage, options = {}) {
        super(userMessage);
        this.name = 'PdfCoRequestError';
        this.status = status;
        this.userMessage = userMessage;
        this.code = options.code || 'pdfco_request_failed';
        this.retryable = options.retryable ?? isRetryableStatus(status);
        this.details = options.details;
    }
}

export function normalizePdfCoPreset(preset) {
    return PDFCO_PRESETS.includes(preset) ? preset : 'balanced';
}

export function buildPdfCoCompressionConfig(preset) {
    const normalizedPreset = normalizePdfCoPreset(preset);

    const presetConfigs = {
        high_quality: {
            images: {
                color: createImageRule(200, 300, 'jpeg', { quality: 78 }),
                grayscale: createImageRule(200, 300, 'jpeg', { quality: 76 }),
                monochrome: createImageRule(300, 450, 'ccitt_g4', {}),
            },
            save: { garbage: 4 },
        },
        balanced: {
            images: {
                color: createImageRule(150, 225, 'jpeg', { quality: 60 }),
                grayscale: createImageRule(150, 225, 'jpeg', { quality: 58 }),
                monochrome: createImageRule(300, 450, 'ccitt_g4', {}),
            },
            save: { garbage: 4 },
        },
        max_compression: {
            images: {
                color: createImageRule(96, 144, 'jpeg', { quality: 35 }),
                grayscale: createImageRule(96, 144, 'jpeg', { quality: 32 }),
                monochrome: createImageRule(200, 300, 'ccitt_g4', {}),
            },
            save: { garbage: 4 },
        },
    };

    return presetConfigs[normalizedPreset];
}

export function buildPdfCoCompressPayload(fileUrl, preset, outputFileName) {
    return {
        async: false,
        url: fileUrl,
        name: outputFileName,
        config: buildPdfCoCompressionConfig(preset),
    };
}

export function buildCompressionResult({
    success,
    inputSizeBytes,
    outputSizeBytes,
    outputFileName,
    error = null,
}) {
    const safeInputSize = Math.max(0, Number(inputSizeBytes || 0));
    const safeOutputSize = Math.max(0, Number(outputSizeBytes || 0));
    const bytesSaved = success ? Math.max(0, safeInputSize - safeOutputSize) : 0;
    const percentReduced = success && safeInputSize > 0
        ? Number(((bytesSaved / safeInputSize) * 100).toFixed(1))
        : 0;

    return {
        success,
        provider: 'pdfco',
        inputSizeBytes: safeInputSize,
        outputSizeBytes: success ? safeOutputSize : 0,
        bytesSaved,
        percentReduced,
        outputFileName,
        error,
    };
}

export async function fetchJsonWithRetry(url, init, options) {
    const response = await fetchWithRetry(url, init, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.error) {
        throw new PdfCoRequestError(
            response.status || Number(data?.status) || 502,
            getFriendlyPdfCoMessage(response.status || Number(data?.status), extractApiMessage(data)),
            {
                details: data,
            }
        );
    }

    return data;
}

export async function fetchWithRetry(url, init = {}, options = {}) {
    const timeoutMs = options.timeoutMs ?? 45_000;
    const maxRetries = options.maxRetries ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 800;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok || !isRetryableStatus(response.status) || attempt === maxRetries) {
                return response;
            }

            lastError = new PdfCoRequestError(
                response.status,
                getFriendlyPdfCoMessage(response.status),
                { retryable: true }
            );
        } catch (error) {
            clearTimeout(timeout);

            if (error?.name === 'AbortError') {
                lastError = new PdfCoRequestError(504, 'PDF.co took too long to respond. Please try again.', {
                    code: 'timeout',
                    retryable: true,
                });
            } else {
                lastError = new PdfCoRequestError(503, 'Unable to reach PDF.co right now. Check your connection and try again.', {
                    code: 'network_error',
                    retryable: true,
                    details: error,
                });
            }
        }

        if (attempt < maxRetries && lastError?.retryable) {
            await delay(retryDelayMs * (attempt + 1));
        }
    }

    throw lastError || new PdfCoRequestError(500, 'PDF compression failed.');
}

export function getFriendlyPdfCoMessage(status, fallbackMessage = '') {
    if (status === 402) {
        return 'PDF.co could not process this request because the account is out of credits or the current plan does not support it.';
    }

    if (status === 401 || status === 403) {
        return 'PDF.co rejected the request. Check the PDFCO_API_KEY configuration.';
    }

    if (status === 429) {
        return 'PDF.co rate limit reached. Please wait a moment and try again.';
    }

    if (status === 413) {
        return 'This PDF is too large for the current compression request. Try a smaller file or upgrade the PDF.co plan.';
    }

    if (status === 408 || status === 504) {
        return 'PDF.co took too long to respond. Please try again.';
    }

    if (status >= 500) {
        return 'PDF.co is temporarily unavailable. Please try again shortly.';
    }

    if (status === 400) {
        return fallbackMessage || 'PDF.co could not compress this PDF.';
    }

    return fallbackMessage || 'PDF compression failed.';
}

export function isRetryableStatus(status) {
    return [408, 429, 500, 502, 503, 504].includes(status);
}

function createImageRule(downsamplePpi, thresholdPpi, compressionFormat, compressionParams) {
    return {
        skip: false,
        downsample: {
            skip: false,
            downsample_ppi: downsamplePpi,
            threshold_ppi: thresholdPpi,
        },
        compression: {
            skip: false,
            compression_format: compressionFormat,
            compression_params: compressionParams,
        },
    };
}

function extractApiMessage(data) {
    if (!data || typeof data !== 'object') {
        return '';
    }

    if (typeof data.message === 'string' && data.message.trim()) {
        return data.message.trim();
    }

    if (typeof data.error === 'string' && data.error.trim()) {
        return data.error.trim();
    }

    return '';
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
