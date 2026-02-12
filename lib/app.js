const pmx = require('pmx')
const pm2 = require('pm2')
const { parseParamToArray, parseParamToNumber, parseBool } = require('./utils')

const defaultOptions = {
  enabled: true,
  /**
   * 排除的 app 名
   */
  excludeApps: [],
  /**
   * 包含的 app 名
   */
  includeApps: [],
  /**
   * 定时检测间隔（ms）
   */
  workerInterval: 60000,
  /**
   * 是否开启僵尸进程守护
   */
  zombieDetection: true,
  /**
   * 僵尸状态最大出现次数
   */
  zombieMaxHits: 10,
  /**
   * 僵尸状态达到最大容忍度时，是否自动重启僵尸进程
   */
  autoRestartWhenZombieDetected: true,
}

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

// 存储每个进程的 CPU 采样历史（pm_id -> [cpu1, cpu2, ...]）
const cpuHistory = new Map()
const zombieRestartHistory = new Map()
const restartFailedHistory = new Map()

/**
 * @param {'log' | 'info' | 'error' | 'warn'} type
 *
 */
const logger = (type, ...args) => {
  return console[type](`[${MODULE_NAME}]`, ...args)
}

/**
 * 判断是否为僵尸进程：最近 ZOMBIE_MAX_HITS 次全是 0%
 */
const isZombie = (history) => {
  return history.length >= ZOMBIE_MAX_HITS && history.every((v) => v === 0)
}

/**
 * check zombie process
 */
const zombieProcessChecker = () => {
  if (!ZOMBIE_DETECTION) return

  pm2.list((err, apps) => {
    apps.forEach((app) => {
      const { name, pm_id, monit, pm2_env } = app

      const appStatus = pm2_env?.status
      const appCpuUsage = monit?.cpu || 0

      if (
        MODULE_NAME === name ||
        (INCLUDE_APPS.length > 0 && !INCLUDE_APPS.includes(name)) ||
        (EXCLUDE_APPS.length > 0 && EXCLUDE_APPS.includes(name))
      ) {
        return
      }

      // 2. 只处理 online 状态的进程
      if (appStatus !== 'online') {
        // 进程不在 online 状态时，清空其历史记录，避免干扰
        cpuHistory.delete(pm_id)
        return
      }

      if (!cpuHistory.has(pm_id)) {
        cpuHistory.set(pm_id, [])
      }

      const history = cpuHistory.get(pm_id)

      history.push(appCpuUsage)

      // 只保留最近 ZOMBIE_MAX_HITS 次记录
      if (history.length > ZOMBIE_MAX_HITS) {
        history.shift()
      }

      // 4. 判断是否为僵尸：最近 ZOMBIE_MAX_HITS 次全是 0%

      if (isZombie(history)) {
        logger('info', `Zombie detected: ${name} (pm_id: ${pm_id})`)

        if (AUTO_RESTART_WHEN_ZOMBIE_DETECTED) {
          logger('info', 'restarting...')

          pm2.restart(pm_id, (restartErr) => {
            if (restartErr) {
              logger(
                'error',
                `Restart failed for ${name} (pm_id: ${pm_id}):`,
                restartErr,
              )

              if (!restartFailedHistory.has(pm_id)) {
                restartFailedHistory.set(pm_id, 1)
              } else {
                restartFailedHistory.set(
                  pm_id,
                  restartFailedHistory.get(pm_id) + 1,
                )
              }

              return
            }

            if (!zombieRestartHistory.has(pm_id)) {
              zombieRestartHistory.set(pm_id, 1)
            } else {
              const history = zombieRestartHistory.get(pm_id)

              zombieRestartHistory.set(pm_id, history + 1)
            }

            logger(
              'info',
              `Restarted ${name} (pm_id: ${pm_id}) successfully!!! Restarted ${zombieRestartHistory.get(pm_id)} times`,
            )

            // 重启后清除该进程的历史记录，避免刚重启又被判定为僵尸
            cpuHistory.delete(pm_id)
          })
        }
      }
    })
  })
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

    zombieProcessChecker()

    setInterval(() => {
      zombieProcessChecker()
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

      for (const [k, v] of restartFailedHistory) {
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

      for (const [pmId, arr] of cpuHistory) {
        if (isZombie(arr)) {
          res.push(pmId)
        }
      }

      if (!res.length) return 'N/A'

      return res.join(',')
    },
  })
}

runModule()
