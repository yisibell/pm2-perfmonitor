const { getExeca } = require('./execa-helper')

/**
 * Linux/macOS 专属：判定进程是否为原生僵尸进程（仅靠系统状态，无CPU检测）
 * @param {number} pid 进程PID（必须为正整数）
 * @returns {Promise<{
 *   isZombie: boolean, // 是否为僵尸进程（state=Z/<defunct>）
 *   exists: boolean    // 进程是否存在
 *   failed?: boolean // 是否获取进程状态失败
 * }>}
 */
const isZombieStateProcess = async (pid) => {
  // 1. 基础参数校验
  if (!Number.isInteger(pid) || pid <= 0) {
    return { isZombie: false, exists: false }
  }

  try {
    // 2. 执行ps命令（Linux/macOS通用，仅获取PID、状态、进程名）
    const cmdArgs =
      process.platform === 'linux'
        ? ['-o', 'pid,state,comm', '-p', pid]
        : ['-o', 'pid,state,command', '-p', pid] // macOS 调整进程名字段

    const execa = await getExeca()

    const { stdout } = await execa('ps', cmdArgs, {
      timeout: 3000, // 3秒超时保护
      reject: false, // 进程不存在时不抛异常，自行解析
    })

    // 3. 解析输出（格式：PID S COMM → 1234 Z node）
    const lines = stdout.trim().split('\n')
    if (lines.length < 2) {
      return { isZombie: false, exists: false } // 进程不存在
    }

    const [pidStr, state, name] = lines[1].trim().split(/\s+/)
    const processExists = Number(pidStr) === pid
    // 4. 核心判定：state=Z 或 进程名包含<defunct>
    const isZombie =
      processExists && (state === 'Z' || name?.includes('<defunct>'))

    return { isZombie, exists: processExists }
  } catch (err) {
    // 权限不足/命令执行失败 → 兜底返回
    console.warn(`[${process.platform}] 检测进程 ${pid} 失败:`, err.message)
    return { isZombie: false, exists: false, failed: true }
  }
}

/**
 * 通过 cpu 值判断是否为僵尸进程：最近连续 N 次 cpu 负载值全是 0%
 * @param { object } opts
 * @param { number[] } opts.cpus - 连续的 cpu 负载值
 * @param { number } opts.maxHits - 最大命中次数
 */
const isZombieCpuProcess = (opts) => {
  const cpus = opts.cpus

  return cpus.length >= opts.maxHits && cpus.every((v) => v === 0)
}

// 导出函数
module.exports = { isZombieStateProcess, isZombieCpuProcess }
