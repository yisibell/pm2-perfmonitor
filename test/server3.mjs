import fs from 'node:fs'
import path from 'node:path'
import inspector from 'node:inspector'
import { createServer } from 'node:http'

// -------------------- SERVER START ----------------------
const { PORT = 3000 } = process.env

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('(server 3) Hello World!\n')
})

// starts a simple http server locally on port 3000
server.listen(PORT, '127.0.0.1', () => {
  console.log('Listening on 127.0.0.1:3000')
})

// -------------------- SERVER END-----------------------

let session = null
let isProfiling = false

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true })
    return dir
  } catch {
    return null
  }
}

const getOutputDir = () => {
  const envDir = process.env.CPU_PROFILE_DIR?.trim()
  if (envDir) {
    const ok = ensureDir(envDir)
    if (ok) return ok
  }

  return ensureDir(path.resolve(process.cwd(), './var/log/pm2'))
}

/**
 * @param {string} method
 * @param { object} params
 * @returns { inspector.Profiler.StopReturnType }
 */
const sessionPost = (method, params) => {
  return new Promise((resolve, reject) => {
    if (!session) {
      reject(new Error('inspector session not initialized'))
      return
    }
    session.post(method, params || {}, (err, result) => {
      if (err) reject(err)
      else resolve(result || {})
    })
  })
}

const startCpuProfile = async () => {
  if (isProfiling) return
  session = new inspector.Session()
  session.connect()
  await sessionPost('Profiler.enable')
  await sessionPost('Profiler.start')
  isProfiling = true
}

const stopCpuProfile = async () => {
  if (!isProfiling || !session) return
  const result = await sessionPost('Profiler.stop')
  const dir = getOutputDir()
  const fileName = `cpu-profile.${process.pid}.${Date.now()}.cpuprofile`
  const filePath = path.join(dir, fileName)
  fs.writeFileSync(filePath, JSON.stringify(result.profile))
  await sessionPost('Profiler.disable')
  session.disconnect()
  session = null
  isProfiling = false
}

/**
 * Dump active handles 和 active requests
 * 用于诊断 CPU 0% 僵尸：直接看到事件循环在等哪个 socket/timer
 */
const dumpActiveResources = () => {
  try {
    const handles = process._getActiveHandles?.() || []
    const requests = process._getActiveRequests?.() || []

    const mem = process.memoryUsage()

    const summary = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(2)} s`,
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
      },
      handleCount: handles.length,
      requestCount: requests.length,
      handles: handles.map((h) => {
        const cname = h.constructor?.name || typeof h
        const info = { type: cname }

        if (cname === 'Socket') {
          info.remoteAddress = h.remoteAddress
          info.remotePort = h.remotePort
          info.localPort = h.localPort
          info.readyState = h.readyState
          info.readable = h.readable
          info.writable = h.writable
          info.destroyed = h.destroyed
          info.bytesRead = h.bytesRead
          info.bytesWritten = h.bytesWritten
        } else if (cname === 'Server') {
          info.address = h.address?.()
        } else if (cname === 'Timeout') {
          info.idleTimeout = h._idleTimeout
          info.hasRef = h.hasRef?.()
        }

        return info
      }),
      requests: requests.map((r) => ({
        type: r.constructor?.name || typeof r,
      })),
    }

    const dir = getOutputDir()
    const fileName = `active-resources.${process.pid}.${Date.now()}.json`
    const filePath = path.join(dir, fileName)
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2))

    console.info(
      '[cpu-profile]',
      `Active resources dumped: ${filePath} (${handles.length} handles, ${requests.length} requests)`,
    )
  } catch (err) {
    console.error('[cpu-profile] dumpActiveResources failed:', err)
  }
}

const run = () => {
  const outputDir = getOutputDir()

  console.info('[cpu-profile]', `dir=${outputDir}`)

  process.on('message', async (packet) => {
    console.info('[cpu-profile]', `pid=${process.pid}`, packet)

    try {
      const eventName = packet?.data?.event

      if (eventName === 'pm2-perfmonitor:cpu-profile-start') {
        // 先 dump active handles/requests — 这是 CPU 0% 僵尸诊断的核心数据
        dumpActiveResources()

        if (isProfiling) {
          await stopCpuProfile()
        }

        await startCpuProfile()
      } else if (eventName === 'pm2-perfmonitor:cpu-profile-stop') {
        await stopCpuProfile()
      }
    } catch (err) {
      console.error('[cpu-profile]', err)

      session?.disconnect()
      session = null
      isProfiling = false
    }
  })
}

run()
