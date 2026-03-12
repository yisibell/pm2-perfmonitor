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

const run = () => {
  const outputDir = getOutputDir()

  console.info('[cpu-profile]', `dir=${outputDir}`)

  process.on('message', async (packet) => {
    console.info('[cpu-profile]', `pid=${process.pid}`, packet)

    try {
      const eventName = packet?.data?.event

      if (eventName === 'pm2-perfmonitor:cpu-profile-start') {
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
