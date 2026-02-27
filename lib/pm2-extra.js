const pm2 = require('pm2')

/**
 * @returns { Promise<pm2.ProcessDescription[]> }
 */
const getPm2ListAsync = () => {
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
const pm2StopAsync = (pm_id) => {
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
  getPm2ListAsync,
  pm2StopAsync,
}
