const pm2 = require('pm2')
const minimist = require('minimist')

/**
 * @param { string } env
 * @returns { pm2.StartOptions }
 */
const getAppConfig = (env) => {
  if (!env) {
    return require('../ecosystem.config.cjs')
  }

  return require(`../ecosystem.${env}.config.cjs`)
}

/**
 * @param { pm2.StartOptions } appConfig
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

          console.log(`应用 [${appName}] 已删除!`)
        }

        console.log(`应用 [${appName}] 重新启动中...`)

        await startAppAsync(appConfig)
      } catch (err) {
        process.exit(2)
      } finally {
        pm2.disconnect()
      }
    })
  })
}

run()
