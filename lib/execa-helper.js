let execaCommandCache

/**
 * 获取 execa 函数（缓存）
 * @returns { import('execa')['execa'] }
 */
const getExeca = async () => {
  if (!execaCommandCache) {
    const execaModule = await import('execa')
    execaCommandCache = execaModule.execa
  }
  return execaCommandCache
}

module.exports = {
  getExeca,
}
