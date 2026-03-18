export const PDFCO_ENV_KEY = 'PDFCO_API_KEY';
export const PDFCO_API_KEY = process.env[PDFCO_ENV_KEY] || '';

export const PDFCO_BASE_URL = 'https://api.pdf.co';
export const PDFCO_UPLOAD_PRESIGNED_URL = `${PDFCO_BASE_URL}/v1/file/upload/get-presigned-url`;
export const PDFCO_COMPRESS_URL = `${PDFCO_BASE_URL}/v2/pdf/compress`;
export const PDFCO_DELETE_URL = `${PDFCO_BASE_URL}/v1/file/delete`;

export const PDFCO_TIMEOUT_MS = 45_000;
export const PDFCO_MAX_RETRIES = 2;
export const PDFCO_RETRY_DELAY_MS = 800;

export function isPdfCoConfigured() {
    return PDFCO_API_KEY.length > 0;
}
