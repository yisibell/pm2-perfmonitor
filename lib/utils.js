const pidusage = require('pidusage')

const parseParamToArray = (value, defaultVal = []) => {
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim())
  }

  return defaultVal
}

const parseParamToNumber = (value) => {
  if (typeof value === 'number') return value
  if (!value) return 0

  if (typeof value === 'string') {
    return Number(value)
  }

  return 0
}

const parseBool = (value, defaultVal = false) => {
  if (typeof value === 'boolean') return value

  if (value === 'true') return true
  if (value === 'false') return false

  return defaultVal
}

/**
 * @param { number} duration - sleep duration (ms)
 */
const sleepAsync = (duration = 0) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

/**
 * 获取指定进程的CPU使用率
 * @param {string| number} pid
 * @returns { Promise<number> } CPU 使用率
 */
const getSysCpuUsageByPid = async (pid) => {
  const stats = await pidusage(pid)

  return stats.cpu
}

module.exports = {
  parseParamToArray,
  parseParamToNumber,
  parseBool,
  sleepAsync,
  getSysCpuUsageByPid,
}
