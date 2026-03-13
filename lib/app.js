const pmx = require('pmx')
const pm2 = require('pm2')
const { listAppsAsync, restartAppAsync } = require('./pm2-extra')
const {
  parseParamToArray,
  parseParamToNumber,
  parseBool,
  sleepAsync,
  getSysCpuUsageByPid,
} = require('./utils')
const { defaultOptions } = require('./defaults')
const { sendMessage } = require('./message')
const { performPerfSampling } = require('./perf-sampler')
const { sendAlert } = require('./alert')

const conf = pmx.initModule({}, (err, incomingConf) => {
  if (err) {
    console.error(`[${incomingConf.module_name}] init module error:`, err)
    process.exit(2)
  }

  return {
    ...defaultOptions,
    ...incomingConf,
  }
})

const Probe = pmx.probe()
const MODULE_NAME = conf.module_name
const MODULE_ENABLED = parseBool(conf.enabled)
const WORKER_INTERVAL = parseParamToNumber(conf.workerInterval)
const INCLUDE_APPS = parseParamToArray(conf.includeApps)
const EXCLUDE_APPS = parseParamToArray(conf.excludeApps)
const ZOMBIE_DETECTION = parseBool(conf.zombieDetection)
const AUTO_RESTART_WHEN_ZOMBIE_DETECTED = parseBool(
  conf.autoRestartWhenZombieDetected,
)
const ZOMBIE_MAX_HITS = parseParamToNumber(conf.zombieMaxHits)
const ZOMBIE_MAX_RESTARTS = parseParamToNumber(conf.zombieMaxRestarts)

const cpuOverloadDetection = parseBool(conf.cpuOverloadDetection)
const cpuOverloadThreshold = parseParamToNumber(conf.cpuOverloadThreshold)
const cpuOverloadMaxHits = parseParamToNumber(conf.cpuOverloadMaxHits)
const enablePerfCollection = parseBool(conf.enablePerfCollection)
const perfReportGenerationDir = conf.perfReportGenerationDir
const flamegraphDir = conf.flamegraphDir
const perfSampleDuration = parseParamToNumber(conf.perfSampleDuration)
const perfSampleFrequency = parseParamToNumber(conf.perfSampleFrequency)
const enableNodeInspectorCollection = parseBool(
  conf.enableNodeInspectorCollection,
)
const nodeInspectorSampleDuration = parseParamToNumber(
  conf.nodeInspectorSampleDuration,
)
const enableAlert = parseBool(conf.enableAlert)
const alertCmdPath = conf.alertCmdPath
const alertEnv = conf.alertEnv
const alertLevel = conf.alertLevel

// 存储每个进程的 CPU 采样历史（pm_id -> [cpu1, cpu2, ...]）
const zombieCpuHistory = new Map()
const zombieRestartHistory = new Map()
const zombieRestartFailedHistory = new Map()

const cpuOverloadHistory = new Map()
const cpuOverloadRestartHistory = new Map()
const cpuOverloadRestartFailedHistory = new Map()

let isProcessCheckerRunning = false

/**
 * perf 样本是否采集中
 * @type { Map<number,boolean> }
 */
const perfSamplingStats = new Map()

/**
 * @param {'log' | 'info' | 'error' | 'warn'} type
 *
 */
const logger = (type, ...args) => {
  return console[type](`[${MODULE_NAME}]`, ...args)
}

/**
 * 判断是否为僵尸进程：最近 ZOMBIE_MAX_HITS 次全是 0%
 * @param { number[] } history
 */
const isZombie = (history) => {
  return history.length >= ZOMBIE_MAX_HITS && history.every((v) => v === 0)
}

/**
 * @param { number[] } history
 */
const isCpuOverload = (history) => {
  return (
    history.length >= cpuOverloadMaxHits &&
    history.every((v) => v >= cpuOverloadThreshold)
  )
}

/**
 * @param { number } pm_id
 * @param { number  } appCpuUsage
 * @returns { number[] } 对应 pm_id 的 CPU 使用率数组
 */
const setZombieCpuHistory = (pm_id, appCpuUsage) => {
  if (!zombieCpuHistory.has(pm_id)) {
    zombieCpuHistory.set(pm_id, [])
  }

  const history = zombieCpuHistory.get(pm_id)

  history.push(appCpuUsage)

  // 只保留最近 ZOMBIE_MAX_HITS 次记录
  if (history.length > ZOMBIE_MAX_HITS) {
    history.shift()
  }

  return history
}

/**
 * @param { number } pm_id
 * @param { number  } appCpuUsage
 * @returns { number[] } 对应 pm_id 的 CPU 使用率数组
 */
const setCpuOverloadHistory = (pm_id, appCpuUsage) => {
  if (!cpuOverloadHistory.has(pm_id)) {
    cpuOverloadHistory.set(pm_id, [])
  }

  const history = cpuOverloadHistory.get(pm_id)

  history.push(appCpuUsage)

  // 只保留最近 x 次记录
  if (history.length > cpuOverloadMaxHits) {
    history.shift()
  }

  return history
}

const setZombieRestartFailedHistory = (pm_id) => {
  if (!zombieRestartFailedHistory.has(pm_id)) {
    zombieRestartFailedHistory.set(pm_id, 1)
  } else {
    zombieRestartFailedHistory.set(
      pm_id,
      zombieRestartFailedHistory.get(pm_id) + 1,
    )
  }
}

const setCpuOverloadRestartFailedHistory = (pm_id) => {
  if (!cpuOverloadRestartFailedHistory.has(pm_id)) {
    cpuOverloadRestartFailedHistory.set(pm_id, 1)
  } else {
    cpuOverloadRestartFailedHistory.set(
      pm_id,
      cpuOverloadRestartFailedHistory.get(pm_id) + 1,
    )
  }
}

/**
 * 发送重启警告
 * @param {string} title
 * @param {string} content
 */
const sendRestartAlert = async (title, content) => {
  if (!enableAlert) return

  return await sendAlert({
    cmd: alertCmdPath,
    env: alertEnv,
    level: alertLevel,
    title: `[${MODULE_NAME}] Alert: ${title}`,
    content,
  })
}

/**
 * check process
 */
const processChecker = async () => {
  if (isProcessCheckerRunning) return

  try {
    isProcessCheckerRunning = true

    const apps = await listAppsAsync()

    for (const app of apps) {
      const { name, pid, pm_id, monit, pm2_env } = app

      const sysCpuUsage = await getSysCpuUsageByPid(pid)

      const appStatus = pm2_env?.status
      const appCpuUsage = sysCpuUsage

      // 非目标应用，跳过
      if (
        MODULE_NAME === name ||
        (INCLUDE_APPS.length > 0 && !INCLUDE_APPS.includes(name)) ||
        (EXCLUDE_APPS.length > 0 && EXCLUDE_APPS.includes(name))
      ) {
        continue
      }

      // 只处理 online 状态的进程
      if (appStatus !== 'online') {
        // 进程不在 online 状态时，清空其历史记录，避免干扰
        zombieCpuHistory.delete(pm_id)
        cpuOverloadHistory.delete(pm_id)

        continue
      }

      const history = setZombieCpuHistory(pm_id, appCpuUsage)
      const history2 = setCpuOverloadHistory(pm_id, appCpuUsage)

      // 发送消息通知对应应用进程，采样 CPU 性能
      if (enableNodeInspectorCollection) {
        if (appCpuUsage >= cpuOverloadThreshold) {
          await sendMessage(pm_id, 'cpu-profile-start')
          await sleepAsync(nodeInspectorSampleDuration * 1000)
          await sendMessage(pm_id, 'cpu-profile-stop')
        }
      }

      // 判断是否为僵尸：最近 ZOMBIE_MAX_HITS 次全是 0%
      if (ZOMBIE_DETECTION && isZombie(history)) {
        logger(
          'info',
          `Zombie detected: ${name} (pm_id: ${pm_id}, pid: ${app.pid})`,
        )

        if (AUTO_RESTART_WHEN_ZOMBIE_DETECTED) {
          if (
            ZOMBIE_MAX_RESTARTS > 0 &&
            zombieRestartHistory.get(pm_id) >= ZOMBIE_MAX_RESTARTS
          ) {
            continue
          }

          logger('info', 'restarting...')

          try {
            await restartAppAsync(pm_id)

            if (!zombieRestartHistory.has(pm_id)) {
              zombieRestartHistory.set(pm_id, 1)
            } else {
              const history = zombieRestartHistory.get(pm_id)

              zombieRestartHistory.set(pm_id, history + 1)
            }

            logger(
              'info',
              `[ZOMBIE] Restarted ${name} (pm_id: ${pm_id}) successfully!!! Restarted ${zombieRestartHistory.get(pm_id)} times`,
            )

            await sendRestartAlert(
              `The zombie process has been restarted!`,
              `appName: ${name}, \n 
                pid: ${pid}, \n 
                pm_id: ${pm_id}, \n 
                restarted: ${zombieRestartHistory.get(pm_id)} times`,
            )

            // 重启后清除该进程的历史记录，避免刚重启又被判定为僵尸
            zombieCpuHistory.delete(pm_id)
          } catch (restartErr) {
            logger(
              'error',
              `[ZOMBIE] Restart failed for ${name} (pm_id: ${pm_id}):`,
              restartErr,
            )

            setZombieRestartFailedHistory(pm_id)
          }
        }
      }
      // CPU 是否持续过载
      else if (cpuOverloadDetection && isCpuOverload(history2)) {
        logger(
          'info',
          `CPU Overload detected: ${name} (pm_id: ${pm_id}, pid: ${app.pid})`,
        )

        if (enablePerfCollection) {
          perfSamplingStats.set(pm_id, true)

          await performPerfSampling({
            pid,
            moduleName: MODULE_NAME,
            perfDir: perfReportGenerationDir,
            flamegraphDir,
            sampleDuration: perfSampleDuration,
            sampleFrequency: perfSampleFrequency,
          })

          perfSamplingStats.delete(pm_id)
        }

        try {
          logger('info', 'restarting...')

          await restartAppAsync(pm_id)

          if (!cpuOverloadRestartHistory.has(pm_id)) {
            cpuOverloadRestartHistory.set(pm_id, 1)
          } else {
            cpuOverloadRestartHistory.set(
              pm_id,
              cpuOverloadRestartHistory.get(pm_id) + 1,
            )
          }

          logger(
            'info',
            `[CPU OVERLOAD] Restarted ${name} (pm_id: ${pm_id}) successfully!!! Restarted ${cpuOverloadRestartHistory.get(pm_id)} times`,
          )

          await sendRestartAlert(
            `CPU overload process restarted!`,
            `appName: ${name}, \n 
              pid: ${pid}, \n 
              pm_id: ${pm_id}, \n 
              restarted: ${cpuOverloadRestartHistory.get(pm_id)} times`,
          )

          cpuOverloadHistory.delete(pm_id)
        } catch (restartErr) {
          logger(
            'error',
            `[CPU OVERLOAD] Restart failed for ${name} (pm_id: ${pm_id}):`,
            restartErr,
          )

          setCpuOverloadRestartFailedHistory(pm_id)
        }
      }
    }
  } catch (err) {
    logger('error', err)
  } finally {
    isProcessCheckerRunning = false
  }
}

const runModule = () => {
  if (!MODULE_ENABLED) return

  // connect to local pm2
  pm2.connect((err) => {
    if (err) {
      logger('error', `PM2 connection error:`, err)

      process.exit(1)
    }

    logger('info', 'Connected to PM2, starting monitor...')

    processChecker()

    setInterval(() => {
      processChecker()
    }, WORKER_INTERVAL)
  })

  /** PROB PMX **/
  Probe.metric({
    name: 'Zombie Restarts',
    value: () => {
      const res = []

      for (const [k, v] of zombieRestartHistory) {
        if (v > 0) {
          res.push([k, v])
        }
      }

      if (!res.length) return 'N/A'

      return res.map((v) => `[${v[0]}]:${v[1]}`).join(' ; ')
    },
  })

  Probe.metric({
    name: 'Zombie Restarts (failed)',
    value: () => {
      const res = []

      for (const [k, v] of zombieRestartFailedHistory) {
        if (v > 0) {
          res.push([k, v])
        }
      }

      if (!res.length) return 'N/A'

      return res.map((v) => `[${v[0]}]:${v[1]}`).join(' ; ')
    },
  })

  Probe.metric({
    name: 'Zombie Processes',
    value: () => {
      const res = []

      for (const [pmId, arr] of zombieCpuHistory) {
        if (isZombie(arr)) {
          res.push(pmId)
        }
      }

      if (!res.length) return 'N/A'

      return res.join(',')
    },
  })

  Probe.metric({
    name: 'CPU Overload Restarts',
    value: () => {
      const res = []

      for (const [k, v] of cpuOverloadRestartHistory) {
        if (v > 0) {
          res.push([k, v])
        }
      }

      if (!res.length) return 'N/A'

      return res.map((v) => `[${v[0]}]:${v[1]}`).join(' ; ')
    },
  })

  Probe.metric({
    name: 'CPU Overload Processes',
    value: () => {
      const res = []

      for (const [pmId, arr] of cpuOverloadHistory) {
        if (isCpuOverload(arr)) {
          res.push(pmId)
        }
      }

      if (!res.length) return 'N/A'

      return res.join(',')
    },
  })

  Probe.metric({
    name: 'CPU Overload Restarts (failed)',
    value: () => {
      const res = []

      for (const [k, v] of cpuOverloadRestartFailedHistory) {
        if (v > 0) {
          res.push([k, v])
        }
      }

      if (!res.length) return 'N/A'

      return res.map((v) => `[${v[0]}]:${v[1]}`).join(' ; ')
    },
  })

  Probe.metric({
    name: 'Processes in Sampling (perf)',
    value: () => {
      const res = []

      for (const [k, v] of perfSamplingStats) {
        if (v === true) {
          res.push(k)
        }
      }

      if (!res.length) return 'N/A'

      return res.join(', ')
    },
  })
}

runModule()
