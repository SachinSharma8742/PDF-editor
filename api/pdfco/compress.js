import {
    PDFCO_API_KEY,
    PDFCO_COMPRESS_URL,
    PDFCO_DELETE_URL,
    PDFCO_MAX_RETRIES,
    PDFCO_RETRY_DELAY_MS,
    PDFCO_TIMEOUT_MS,
    PDFCO_UPLOAD_PRESIGNED_URL,
    isPdfCoConfigured,
} from '../_lib/pdfcoConfig.js';
import {
    PdfCoRequestError,
    buildCompressionResult,
    buildPdfCoCompressPayload,
    fetchJsonWithRetry,
    fetchWithRetry,
    getFriendlyPdfCoMessage,
    normalizePdfCoPreset,
} from '../_lib/pdfcoCompression.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return sendJson(
            res,
            405,
            buildCompressionResult({
                success: false,
                inputSizeBytes: 0,
                outputSizeBytes: 0,
                outputFileName: 'document-compressed.pdf',
                error: 'Only POST is supported for PDF compression.',
            })
        );
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const preset = normalizePdfCoPreset(requestUrl.searchParams.get('preset'));
    const requestFileName = sanitizePdfFileName(requestUrl.searchParams.get('name') || 'document.pdf');
    const outputFileName = buildOutputFileName(requestFileName);

    const inputBuffer = await readRequestBody(req);
    const inputSizeBytes = inputBuffer.byteLength;

    if (!isPdfCoConfigured()) {
        return sendJson(
            res,
            500,
            buildCompressionResult({
                success: false,
                inputSizeBytes,
                outputSizeBytes: 0,
                outputFileName,
                error: 'PDF compression is not configured. Add PDFCO_API_KEY to the environment.',
            })
        );
    }

    if (inputSizeBytes === 0) {
        return sendJson(
            res,
            400,
            buildCompressionResult({
                success: false,
                inputSizeBytes: 0,
                outputSizeBytes: 0,
                outputFileName,
                error: 'No PDF file data was received.',
            })
        );
    }

    let uploadedFileUrl = '';
    let outputTempUrl = '';

    try {
        const uploadTicket = await fetchJsonWithRetry(
            `${PDFCO_UPLOAD_PRESIGNED_URL}?contenttype=application/octet-stream&name=${encodeURIComponent(requestFileName)}`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'x-api-key': PDFCO_API_KEY,
                },
            },
            getRetryOptions()
        );

        uploadedFileUrl = uploadTicket.url;

        const uploadResponse = await fetchWithRetry(
            uploadTicket.presignedUrl,
            {
                method: 'PUT',
                headers: {
                    'content-type': 'application/octet-stream',
                },
                body: inputBuffer,
            },
            getRetryOptions()
        );

        if (!uploadResponse.ok) {
            throw new PdfCoRequestError(uploadResponse.status, getFriendlyPdfCoMessage(uploadResponse.status));
        }

        const compressPayload = buildPdfCoCompressPayload(uploadedFileUrl, preset, outputFileName);
        const compressionResponse = await fetchJsonWithRetry(
            PDFCO_COMPRESS_URL,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'x-api-key': PDFCO_API_KEY,
                },
                body: JSON.stringify(compressPayload),
            },
            getRetryOptions()
        );

        outputTempUrl = compressionResponse.url;

        const downloadResponse = await fetchWithRetry(
            compressionResponse.url,
            {
                method: 'GET',
            },
            getRetryOptions()
        );

        if (!downloadResponse.ok) {
            throw new PdfCoRequestError(downloadResponse.status, getFriendlyPdfCoMessage(downloadResponse.status));
        }

        const pdfBuffer = Buffer.from(await downloadResponse.arrayBuffer());
        const finalBuffer = pdfBuffer.byteLength < inputSizeBytes ? pdfBuffer : inputBuffer;
        const result = buildCompressionResult({
            success: true,
            inputSizeBytes,
            outputSizeBytes: finalBuffer.byteLength,
            outputFileName: sanitizePdfFileName(compressionResponse.name || outputFileName),
        });

        await Promise.allSettled([
            safeDelete(uploadedFileUrl),
            safeDelete(outputTempUrl),
        ]);

        res.statusCode = 200;
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.outputFileName}"`);
        res.setHeader(
            'Access-Control-Expose-Headers',
            'content-disposition,x-compression-provider,x-input-size-bytes,x-output-size-bytes,x-bytes-saved,x-percent-reduced,x-output-file-name'
        );
        res.setHeader('x-compression-provider', result.provider);
        res.setHeader('x-input-size-bytes', String(result.inputSizeBytes));
        res.setHeader('x-output-size-bytes', String(result.outputSizeBytes));
        res.setHeader('x-bytes-saved', String(result.bytesSaved));
        res.setHeader('x-percent-reduced', String(result.percentReduced));
        res.setHeader('x-output-file-name', result.outputFileName);
        res.end(finalBuffer);
    } catch (error) {
        await Promise.allSettled([
            safeDelete(uploadedFileUrl),
            safeDelete(outputTempUrl),
        ]);

        const status = error instanceof PdfCoRequestError
            ? error.status
            : 500;
        const message = error instanceof PdfCoRequestError
            ? error.userMessage
            : 'PDF compression failed.';

        return sendJson(
            res,
            status,
            buildCompressionResult({
                success: false,
                inputSizeBytes,
                outputSizeBytes: 0,
                outputFileName,
                error: message,
            })
        );
    }
}

async function readRequestBody(req) {
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

function sanitizePdfFileName(fileName) {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function buildOutputFileName(fileName) {
    return fileName.replace(/\.pdf$/i, '-compressed.pdf');
}

function getRetryOptions() {
    return {
        timeoutMs: PDFCO_TIMEOUT_MS,
        maxRetries: PDFCO_MAX_RETRIES,
        retryDelayMs: PDFCO_RETRY_DELAY_MS,
    };
}

async function safeDelete(url) {
    if (!url) {
        return;
    }

    try {
        await fetchJsonWithRetry(
            PDFCO_DELETE_URL,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'x-api-key': PDFCO_API_KEY,
                },
                body: JSON.stringify({ url }),
            },
            getRetryOptions()
        );
    } catch {
        // Cleanup is best-effort only.
    }
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}
