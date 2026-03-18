export type PdfCoCompressionPreset = 'high_quality' | 'balanced' | 'max_compression';

export interface PdfCoCompressionResult {
    success: boolean;
    provider: 'pdfco';
    inputSizeBytes: number;
    outputSizeBytes: number;
    bytesSaved: number;
    percentReduced: number;
    outputFileName: string;
    error: string | null;
    blob?: Blob;
}

const DEFAULT_PROVIDER: PdfCoCompressionResult['provider'] = 'pdfco';

export async function compressPdfWithPdfCo(
    file: File,
    preset: PdfCoCompressionPreset = 'balanced'
): Promise<PdfCoCompressionResult> {
    const safePreset = normalizePreset(preset);
    const fallbackFileName = buildOutputFileName(file.name || 'document.pdf');

    try {
        const response = await fetch(
            `/api/pdfco/compress?preset=${encodeURIComponent(safePreset)}&name=${encodeURIComponent(file.name || 'document.pdf')}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/pdf',
                },
                body: file,
            }
        );

        if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
            const payload = await response.json().catch(() => null);
            return {
                success: false,
                provider: DEFAULT_PROVIDER,
                inputSizeBytes: file.size,
                outputSizeBytes: 0,
                bytesSaved: 0,
                percentReduced: 0,
                outputFileName: payload?.outputFileName || fallbackFileName,
                error: payload?.error || getFriendlyClientErrorMessage(response.status),
            };
        }

        const blob = await response.blob();
        const outputSizeBytes = readNumberHeader(response, 'x-output-size-bytes', blob.size);
        const inputSizeBytes = readNumberHeader(response, 'x-input-size-bytes', file.size);
        const bytesSaved = readNumberHeader(response, 'x-bytes-saved', Math.max(0, inputSizeBytes - outputSizeBytes));
        const percentReduced = readNumberHeader(
            response,
            'x-percent-reduced',
            inputSizeBytes > 0 ? Number(((bytesSaved / inputSizeBytes) * 100).toFixed(1)) : 0
        );
        const outputFileName = response.headers.get('x-output-file-name')
            || readFileNameFromDisposition(response.headers.get('content-disposition'))
            || fallbackFileName;

        return {
            success: true,
            provider: DEFAULT_PROVIDER,
            inputSizeBytes,
            outputSizeBytes,
            bytesSaved,
            percentReduced,
            outputFileName,
            error: null,
            blob,
        };
    } catch (error) {
        return {
            success: false,
            provider: DEFAULT_PROVIDER,
            inputSizeBytes: file.size,
            outputSizeBytes: 0,
            bytesSaved: 0,
            percentReduced: 0,
            outputFileName: fallbackFileName,
            error: getFriendlyClientErrorMessage(undefined, error),
        };
    }
}

function normalizePreset(preset: PdfCoCompressionPreset) {
    return ['high_quality', 'balanced', 'max_compression'].includes(preset)
        ? preset
        : 'balanced';
}

function buildOutputFileName(fileName: string) {
    const safeFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    return safeFileName.replace(/\.pdf$/i, '-compressed.pdf');
}

function readNumberHeader(response: Response, headerName: string, fallback: number) {
    const rawValue = response.headers.get(headerName);
    if (!rawValue) {
        return fallback;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readFileNameFromDisposition(contentDisposition: string | null) {
    if (!contentDisposition) {
        return null;
    }

    const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
    return match?.[1] || null;
}

function getFriendlyClientErrorMessage(status?: number, error?: unknown) {
    if (status === 401 || status === 403) {
        return 'Compression is unavailable because the PDF.co API key is missing or invalid.';
    }

    if (status === 402) {
        return 'Compression is unavailable because the PDF.co account is out of credits or the plan does not support this request.';
    }

    if (status === 404 || status === 405) {
        return 'The compression service route is unavailable. Run the app with the server route enabled or deploy it to Vercel.';
    }

    if (status === 408 || status === 504) {
        return 'Compression timed out while waiting for PDF.co. Please try again.';
    }

    if (status === 413) {
        return 'This PDF is too large for the current compression request.';
    }

    if (status === 429) {
        return 'PDF.co rate limit reached. Please wait a moment and try again.';
    }

    if (typeof status === 'number' && status >= 500) {
        return 'The compression service is temporarily unavailable. Please try again shortly.';
    }

    if (error instanceof Error && error.name === 'AbortError') {
        return 'Compression timed out while waiting for the server. Please try again.';
    }

    return 'Unable to reach the compression service right now. Check your connection and try again.';
}
