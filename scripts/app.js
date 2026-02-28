const pm2 = require('pm2')
const minimist = require('minimist')

/**
 * @typedef { Object } MultiAppConfig
 * @property { pm2.StartOptions[] } apps
 */

/**
 * @typedef { pm2.StartOptions | MultiAppConfig } AppConfig
 */

/**
 * @param { string } env
 * @returns { AppConfig }
 */
const getAppConfig = (env) => {
  if (!env) {
    return require('../ecosystem.config.cjs')
  }

  return require(`../ecosystem.${env}.config.cjs`)
}

/**
 * @param { AppConfig } appConfig
 * @returns { string }
 */
const getAppName = (appConfig) => {
  if (Array.isArray(appConfig.apps)) {
    return appConfig.apps[0].name
  }

  return appConfig.name
}

/**
 * @param { string | number } p
 */
const deleteAppAsync = (p) => {
  return new Promise((resolve, reject) => {
    pm2.delete(p, (err) => {
      if (err) {
        console.error(`删除应用 "${p}" 失败:`, err)
        return reject(err)
      }

      resolve()
    })
  })
}

/**
 * @param { pm2.StartOptions } config
 */
const startAppAsync = (config) => {
  const appName = getAppName(config)

  return new Promise((resolve, reject) => {
    pm2.start(config, (err) => {
      if (err) {
        console.error(`应用 "${appName}" 启动失败:`, err)

        return reject(err)
      }

      console.log(`✅ 应用 "${appName}" 已启动并受守护。`)
      resolve()
    })
  })
}

/**
 * 格式化字节数为可读字符串
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  if (!bytes) return '0b'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 将毫秒数格式化为简洁的运行时间字符串（风格类似 pm2 list）
 * @param {number} ms 毫秒数
 * @returns {string}
 */
const formatUptime = (ms) => {
  if (!ms || ms <= 0) return '0s'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/**
 * 获取并打印当前 PM2 应用列表（类似 pm2 list）
 * @returns {Promise<void>}
 */
const listAppsAndDisplay = () => {
  return new Promise((resolve, reject) => {
    pm2.list((err, apps) => {
      if (err) {
        console.error('获取应用列表失败:', err)
        return reject(err)
      }

      const now = Date.now()

      // 将每个进程转换为包含所需字段的对象，并对 CPU 和内存进行格式化
      const tableData = apps.map((app) => {
        const pm2Env = app.pm2_env || {}
        const monit = app.monit || { cpu: 0, memory: 0 }

        // 计算 uptime（毫秒）
        const uptimeMs = pm2Env.pm_uptime ? now - pm2Env.pm_uptime : 0

        return {
          id: app.pm_id,
          pid: app.pid,
          uptime: formatUptime(uptimeMs),
          name: app.name || '',
          mode: pm2Env.exec_mode || '-',
          status: pm2Env.status || 'unknown',
          cpu: monit.cpu !== undefined ? `${monit.cpu}%` : '0%',
          memory: formatBytes(monit.memory) || '0b',
        }
      })

      console.log('\n当前 PM2 应用列表:')
      // 使用 console.table 打印，并通过第二个参数指定列的显示顺序
      console.table(tableData, [
        'id',
        'name',
        'pid',
        'uptime',
        'mode',
        'status',
        'cpu',
        'memory',
      ])

      resolve()
    })
  })
}

const run = () => {
  const argv = minimist(process.argv.slice(2))
  const { env } = argv

  const appConfig = getAppConfig(env)

  const appName = getAppName(appConfig)

  pm2.connect((err) => {
    if (err) {
      console.error('连接 PM2 失败:', err)
      pm2.disconnect()
      process.exit(2)
    }

    pm2.list(async (err, apps) => {
      if (err) {
        console.error('获取 PM2 列表失败:', err)
        pm2.disconnect()
        process.exit(2)
      }

      const existingApp = apps.find((p) => p.name === appName)

      try {
        if (existingApp) {
          await deleteAppAsync(existingApp.name)

          console.log(`应用 "${appName}" 已删除!`)
        }

        console.log(`应用 "${appName}" 重新启动中...`)

        await startAppAsync(appConfig)
        await listAppsAndDisplay()
      } catch (err) {
        process.exit(2)
      } finally {
        pm2.disconnect()
      }
    })
  })
}

run()
