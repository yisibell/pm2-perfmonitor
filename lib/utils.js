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

module.exports = {
  parseParamToArray,
  parseParamToNumber,
  parseBool,
}
