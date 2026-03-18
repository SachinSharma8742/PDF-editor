# Premium PDF Editor

React + TypeScript PDF editor built with Vite for the client and a small Vercel-style serverless route for PDF compression.

## Compression Flow

PDF compression now uses one provider only: PDF.co.

Flow:

1. The app builds the current export snapshot into a PDF.
2. The client sends that PDF to `/api/pdfco/compress`.
3. The server route uploads the file to PDF.co using a presigned upload URL.
4. The server calls the PDF.co compress API with one preset:
   - `high_quality`
   - `balanced`
   - `max_compression`
5. The server downloads the compressed PDF and returns it to the app.
6. The app downloads the final file and shows size reduction stats.

If PDF.co returns a file that is larger than the input, the route falls back to the original bytes so users do not get a fake "compressed" file that is actually bigger.

## PDF.co Configuration

Compression reads the API key from the server environment only.

Required variable:

```bash
PDFCO_API_KEY=your_pdfco_api_key_here
```

An example file is included at `.env.example`.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local env file:

   ```bash
   copy .env.example .env
   ```

3. Add your PDF.co API key to `.env`.
4. Start the frontend:

   ```bash
   npm run dev
   ```

5. For the compression API route, run the app through a server runtime that serves the `api/` folder, such as Vercel local dev:

   ```bash
   vercel dev
   ```

`npm run dev` starts the Vite client only. Compression requires the `/api/pdfco/compress` server route as well.

## Vercel Setup

1. Open the project in Vercel.
2. Go to `Project Settings -> Environment Variables`.
3. Add:

   ```text
   Name: PDFCO_API_KEY
   Value: your_pdfco_api_key_here
   ```

4. Apply it to the environments you use, usually `Development`, `Preview`, and `Production`.
5. Redeploy after saving the variable.

## Presets

- `high_quality`: lightest compression and best fidelity.
- `balanced`: default preset for general use.
- `max_compression`: strongest size reduction.

Preset mapping lives in `api/_lib/pdfcoCompression.js`.

## Error Handling

The app returns clean user-facing errors for:

- invalid or missing API key (`401` / `403`)
- rate limiting (`429`)
- out-of-credits / unsupported plan (`402`)
- timeouts
- network failures
- oversized uploads (`413`)

Unhandled exceptions are caught and converted into a standard response object.

## Response Shape

Successful and failed compression responses are normalized to:

```ts
{
  success: boolean;
  provider: "pdfco";
  inputSizeBytes: number;
  outputSizeBytes: number;
  bytesSaved: number;
  percentReduced: number;
  outputFileName: string;
  error: string | null;
}
```

## Known Limitations

- PDF.co compression is server-backed, not purely client-side.
- PDF.co credits and rate limits depend on your account plan.
- PDF.co advertises free signup credits, but long-term limits depend on the active plan.
- Temporary uploaded files are hosted by PDF.co during processing and should be treated as third-party storage.
- This app currently uses synchronous compression requests with a server timeout, so very large or slow jobs may fail and should be retried.

## Development Commands

```bash
npm run dev
npm run build
npm test
```

## Tests

Compression tests cover:

- preset normalization
- preset-to-config mapping
- standardized response metadata
- friendly error messages
- retry/error wrapping for API, timeout, and network failures
