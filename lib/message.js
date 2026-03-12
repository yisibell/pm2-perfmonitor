const pm2 = require('pm2')

/**
 * @param { number } pm_id - pm2 应用id
 * @param { string } eventName - 事件名
 * @param { object } [data] - 发送的数据
 * @returns { Promise<void> }
 */
const sendMessage = (pm_id, eventName, data) => {
  return new Promise((resolve, reject) => {
    pm2.sendDataToProcessId(
      pm_id,
      {
        id: pm_id,
        type: 'process:msg',
        topic: true,
        data: {
          event: `pm2-perfmonitor:${eventName}`,
          data,
        },
      },
      (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      },
    )
  })
}

module.exports = {
  sendMessage,
}
