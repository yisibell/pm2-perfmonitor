const pm2 = require('pm2')

/**
 * @param { number } pid 进程id
 * @param { string } eventName 事件名
 * @param { Object } data
 */
const sendMessage = (pid, eventName, data) => {
  pm2.sendDataToProcessId(pid, {
    id: pid,
    type: 'process:msg',
    topic: true,
    data: {
      event: `pm2-perfmonitor:${eventName}`,
      data,
    },
  })
}

module.exports = {
  sendMessage,
}
