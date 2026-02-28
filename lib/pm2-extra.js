const pm2 = require('pm2')

/**
 * @returns { Promise<pm2.ProcessDescription[]> }
 */
const listAppsAsync = () => {
  return new Promise((resolve, reject) => {
    pm2.list((err, apps) => {
      if (err) {
        return reject(err)
      }

      resolve(apps)
    })
  })
}

/**
 * @param { string | number} pm_id
 * @returns { Promise<void> }
 */
const stopAppAsync = (pm_id) => {
  return new Promise((resolve, reject) => {
    pm2.stop(pm_id, (err) => {
      if (err) {
        return reject(err)
      }

      resolve()
    })
  })
}

module.exports = {
  listAppsAsync,
  stopAppAsync,
}
