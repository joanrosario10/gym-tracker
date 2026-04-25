import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Dev-only: runs files in /api/*.ts as edge-style handlers, the same way
 * Vercel does in production. Avoids needing `vercel dev` for local work.
 *
 * Maps GET/POST /api/foo  →  api/foo.ts (default export, signature: (req: Request) => Promise<Response>)
 */
export default function apiPlugin(): Plugin {
  const apiDir = path.resolve(process.cwd(), 'api')

  return {
    name: 'dev-api',
    configResolved(config) {
      // /api functions read process.env.NVIDIA_API_KEY etc. — Vite normally only
      // exposes VITE_-prefixed vars, so we hydrate the full set into process.env
      // for the dev server side only.
      const env = loadEnv(config.mode, process.cwd(), '')
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
        const fnName = url.pathname.replace(/^\/api\//, '').split('/')[0]
        if (!fnName) return next()

        const filePath = path.join(apiDir, `${fnName}.ts`)
        if (!fs.existsSync(filePath)) return next()

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body =
            chunks.length && req.method !== 'GET' && req.method !== 'HEAD'
              ? Buffer.concat(chunks)
              : undefined

          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) headers.set(k, v.join(','))
            else if (typeof v === 'string') headers.set(k, v)
          }

          const webReq = new Request(url.toString(), {
            method: req.method,
            headers,
            body,
          })

          const mod = await server.ssrLoadModule(filePath)
          const handler = (mod as { default?: (r: Request) => Promise<Response> }).default
          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'handler_not_exported', file: `api/${fnName}.ts` }))
            return
          }

          const response = await handler(webReq)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          console.error('[dev-api] error in', fnName, err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'dev_handler_threw', message: String((err as Error)?.message ?? err) }))
        }
      })
    },
  }
}
