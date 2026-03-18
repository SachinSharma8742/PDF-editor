import assert from 'node:assert/strict';
import {
    PDFCO_PRESETS,
    PdfCoRequestError,
    buildCompressionResult,
    buildPdfCoCompressPayload,
    buildPdfCoCompressionConfig,
    fetchJsonWithRetry,
    fetchWithRetry,
    getFriendlyPdfCoMessage,
    normalizePdfCoPreset,
} from '../api/_lib/pdfcoCompression.js';

const tests = [];

function test(name, fn) {
    tests.push({ name, fn });
}

test('preset normalization falls back to balanced', () => {
    assert.deepEqual(PDFCO_PRESETS, ['high_quality', 'balanced', 'max_compression']);
    assert.equal(normalizePdfCoPreset('high_quality'), 'high_quality');
    assert.equal(normalizePdfCoPreset('balanced'), 'balanced');
    assert.equal(normalizePdfCoPreset('max_compression'), 'max_compression');
    assert.equal(normalizePdfCoPreset('unknown'), 'balanced');
    assert.equal(normalizePdfCoPreset(undefined), 'balanced');
});

test('preset mapping matches the supported PDF.co compression config', () => {
    const highQuality = buildPdfCoCompressionConfig('high_quality');
    const balanced = buildPdfCoCompressionConfig('balanced');
    const maxCompression = buildPdfCoCompressionConfig('max_compression');

    assert.equal(highQuality.images.color.downsample.downsample_ppi, 200);
    assert.equal(highQuality.images.color.compression.compression_format, 'jpeg');
    assert.equal(highQuality.images.color.compression.compression_params.quality, 78);

    assert.equal(balanced.images.color.downsample.downsample_ppi, 150);
    assert.equal(balanced.images.grayscale.compression.compression_params.quality, 58);
    assert.equal(balanced.images.monochrome.compression.compression_format, 'ccitt_g4');

    assert.equal(maxCompression.images.color.downsample.downsample_ppi, 96);
    assert.equal(maxCompression.images.color.compression.compression_params.quality, 35);
    assert.equal(maxCompression.save.garbage, 4);
});

test('payload builder returns a synchronous PDF.co compress request', () => {
    const payload = buildPdfCoCompressPayload(
        'https://example.com/input.pdf',
        'balanced',
        'sample-compressed.pdf'
    );

    assert.equal(payload.async, false);
    assert.equal(payload.url, 'https://example.com/input.pdf');
    assert.equal(payload.name, 'sample-compressed.pdf');
    assert.equal(payload.config.images.color.downsample.downsample_ppi, 150);
});

test('response metadata is standardized for success and failure cases', () => {
    const successResult = buildCompressionResult({
        success: true,
        inputSizeBytes: 1000,
        outputSizeBytes: 400,
        outputFileName: 'sample-compressed.pdf',
    });

    assert.deepEqual(successResult, {
        success: true,
        provider: 'pdfco',
        inputSizeBytes: 1000,
        outputSizeBytes: 400,
        bytesSaved: 600,
        percentReduced: 60,
        outputFileName: 'sample-compressed.pdf',
        error: null,
    });

    const failedResult = buildCompressionResult({
        success: false,
        inputSizeBytes: 1000,
        outputSizeBytes: 400,
        outputFileName: 'sample-compressed.pdf',
        error: 'PDF compression failed.',
    });

    assert.deepEqual(failedResult, {
        success: false,
        provider: 'pdfco',
        inputSizeBytes: 1000,
        outputSizeBytes: 0,
        bytesSaved: 0,
        percentReduced: 0,
        outputFileName: 'sample-compressed.pdf',
        error: 'PDF compression failed.',
    });
});

test('friendly error messages cover auth, rate limits, credits, timeouts, and file size', () => {
    assert.equal(
        getFriendlyPdfCoMessage(401),
        'PDF.co rejected the request. Check the PDFCO_API_KEY configuration.'
    );
    assert.equal(
        getFriendlyPdfCoMessage(403),
        'PDF.co rejected the request. Check the PDFCO_API_KEY configuration.'
    );
    assert.equal(
        getFriendlyPdfCoMessage(402),
        'PDF.co could not process this request because the account is out of credits or the current plan does not support it.'
    );
    assert.equal(
        getFriendlyPdfCoMessage(429),
        'PDF.co rate limit reached. Please wait a moment and try again.'
    );
    assert.equal(
        getFriendlyPdfCoMessage(504),
        'PDF.co took too long to respond. Please try again.'
    );
    assert.equal(
        getFriendlyPdfCoMessage(413),
        'This PDF is too large for the current compression request. Try a smaller file or upgrade the PDF.co plan.'
    );
});

test('fetchJsonWithRetry converts API errors into PdfCoRequestError', async () => {
    await withMockedFetch(
        async () => new Response(
            JSON.stringify({ error: true, message: 'Too many requests' }),
            {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            }
        ),
        async () => {
            await assert.rejects(
                fetchJsonWithRetry('https://example.com', {}, {
                    maxRetries: 0,
                    retryDelayMs: 0,
                    timeoutMs: 50,
                }),
                (error) => {
                    assert(error instanceof PdfCoRequestError);
                    assert.equal(error.status, 429);
                    assert.equal(error.userMessage, 'PDF.co rate limit reached. Please wait a moment and try again.');
                    return true;
                }
            );
        }
    );
});

test('fetchWithRetry maps network failures to a friendly error', async () => {
    await withMockedFetch(
        async () => {
            throw new TypeError('fetch failed');
        },
        async () => {
            await assert.rejects(
                fetchWithRetry('https://example.com', {}, {
                    maxRetries: 0,
                    retryDelayMs: 0,
                    timeoutMs: 50,
                }),
                (error) => {
                    assert(error instanceof PdfCoRequestError);
                    assert.equal(error.status, 503);
                    assert.equal(error.code, 'network_error');
                    assert.equal(error.userMessage, 'Unable to reach PDF.co right now. Check your connection and try again.');
                    return true;
                }
            );
        }
    );
});

test('fetchWithRetry maps aborts to a timeout error', async () => {
    await withMockedFetch(
        async () => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            throw error;
        },
        async () => {
            await assert.rejects(
                fetchWithRetry('https://example.com', {}, {
                    maxRetries: 0,
                    retryDelayMs: 0,
                    timeoutMs: 50,
                }),
                (error) => {
                    assert(error instanceof PdfCoRequestError);
                    assert.equal(error.status, 504);
                    assert.equal(error.code, 'timeout');
                    assert.equal(error.userMessage, 'PDF.co took too long to respond. Please try again.');
                    return true;
                }
            );
        }
    );
});

async function withMockedFetch(mockFetch, fn) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
        await fn();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

let failed = 0;

for (const { name, fn } of tests) {
    try {
        await fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        failed += 1;
        console.error(`FAIL ${name}`);
        console.error(error instanceof Error ? error.stack || error.message : error);
    }
}

if (failed > 0) {
    console.error(`\n${failed} PDF.co test${failed === 1 ? '' : 's'} failed.`);
    process.exit(1);
}

console.log(`\n${tests.length} PDF.co tests passed.`);
