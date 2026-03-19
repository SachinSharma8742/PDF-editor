import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import pdfCoCompressHandler from './api/pdfco/compress.js'
import localCompressHandler from './api/compress.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (!process.env.PDFCO_API_KEY && env.PDFCO_API_KEY) {
    process.env.PDFCO_API_KEY = env.PDFCO_API_KEY
  }

  const pdfCoDevPlugin: Plugin = {
    name: 'pdfco-dev-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage & { url?: string }, res: ServerResponse, next: () => void) => {
        if (req.url?.startsWith('/api/compress')) {
          Promise.resolve(localCompressHandler(req, res)).catch(() => {
            if (res.writableEnded) {
              return
            }

            res.statusCode = 500
            res.setHeader('Cache-Control', 'no-store')
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({
              success: false,
              compressedPdf: '',
              originalSize: 0,
              compressedSize: 0,
              ratio: 0,
              error: 'Local compression middleware failed.',
            }))
          })
          return
        }

        if (!req.url?.startsWith('/api/pdfco/compress')) {
          return next()
        }

        Promise.resolve(pdfCoCompressHandler(req, res)).catch(() => {
          if (res.writableEnded) {
            return
          }

          res.statusCode = 500
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            success: false,
            provider: 'pdfco',
            inputSizeBytes: 0,
            outputSizeBytes: 0,
            bytesSaved: 0,
            percentReduced: 0,
            outputFileName: 'document-compressed.pdf',
            error: 'Local PDF.co compression middleware failed.',
          }))
        })
      })
    },
  }

  return {
    plugins: [react(), pdfCoDevPlugin],
    optimizeDeps: {
      include: ['react-konva-utils'],
      exclude: ['onnxruntime-web']
    },
    worker: {
      format: 'es'
    }
  }
})

// sachin