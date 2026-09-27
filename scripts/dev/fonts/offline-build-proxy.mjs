// Dev-only (BUG-2609-062): filtering forward proxy for checking that
// `next build` fetches no fonts from Google. Refuses fonts.googleapis.com
// and fonts.gstatic.com (CONNECT and plain HTTP), tunnels everything else,
// and logs every host it's asked for.
//
// Blocking at the Node level (NODE_OPTIONS --require) does not work: under
// Turbopack the font fetch runs inside the native @next/swc binary. And the
// hosts file needs admin rights. A proxy works for both.
//
// Usage (Git Bash, from the repo root):
//   node scripts/dev/fonts/offline-build-proxy.mjs 18062 proxy.log &
//   export HTTPS_PROXY=http://127.0.0.1:18062 HTTP_PROXY=$HTTPS_PROXY ALL_PROXY=$HTTPS_PROXY
//   export https_proxy=$HTTPS_PROXY http_proxy=$HTTPS_PROXY all_proxy=$HTTPS_PROXY
//   rm -rf .next && npx next build
//   grep -c BLOCKED proxy.log    # expect 0
// Negative control: a layout.tsx that still loads from Google must fail
// this build with "issue establishing a connection" errors.
import http from "node:http"
import net from "node:net"
import fs from "node:fs"

const PORT = Number(process.argv[2] || 18062)
const LOG = process.argv[3] || "proxy.log"
const BLOCKED = /(^|\.)fonts\.(googleapis|gstatic)\.com$/i
const log = (s) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${s}\n`)

const server = http.createServer((req, res) => {
  let host = ""
  try { host = new URL(req.url).hostname } catch {}
  if (BLOCKED.test(host)) { log(`BLOCKED http ${host}`); res.writeHead(403); return res.end("blocked") }
  log(`PASS http ${host}`)
  const u = new URL(req.url)
  const up = http.request({ host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers)
    r.pipe(res)
  })
  up.on("error", () => { res.writeHead(502); res.end() })
  req.pipe(up)
})

server.on("connect", (req, sock, head) => {
  const [host, port] = req.url.split(":")
  if (BLOCKED.test(host)) { log(`BLOCKED connect ${host}`); sock.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return }
  log(`PASS connect ${host}`)
  const up = net.connect(Number(port) || 443, host, () => {
    sock.write("HTTP/1.1 200 Connection Established\r\n\r\n")
    up.write(head)
    up.pipe(sock)
    sock.pipe(up)
  })
  up.on("error", () => sock.end())
  sock.on("error", () => up.destroy())
})

server.listen(PORT, "127.0.0.1", () => log(`listening ${PORT}`))
