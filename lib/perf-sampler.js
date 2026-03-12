const fs = require('fs-extra')
const path = require('path')

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

/**
 * 执行命令（不通过 shell，直接使用参数数组）
 * @param {string} cmd - 命令名称
 * @param {string[]} args - 参数列表
 * @param {object} options - execa 选项
 * @returns {Promise<boolean>} 是否成功
 */
const execCommand = async (cmd, args, options = {}) => {
  try {
    const execa = await getExeca()

    await execa(cmd, args, options)

    return true
  } catch (err) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`, err.message)
    return false
  }
}

/**
 * 生成安全的文件时间戳（不依赖区域）
 */
const getSafeTimestamp = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}_${h}${min}${s}`
}

/**
 * 执行 Perf 采样并生成火焰图
 * @param {Object} options - 配置项
 * @param {number} options.pid - 进程 PID
 * @param {string} options.moduleName - 模块名（用于日志前缀）
 * @param {string} options.perfDir - Perf 文件存储目录（当未提供 perfDataFile 时用于生成默认路径）
 * @param {string} options.flamegraphDir - 火焰图工具目录
 * @param {number} [options.sampleDuration=10] - 采样时长（秒）
 * @param {number} [options.sampleFrequency=99] - 采样频率（Hz）
 * @param {string} [options.perfDataFile] - 自定义 perf 数据文件路径（若未提供则自动生成）
 * @param {boolean} [options.keepPerfData=false] - 是否保留原始 perf 数据文件（默认 false，即采样后删除）
 */
const performPerfSampling = async ({
  pid,
  moduleName,
  perfDir,
  flamegraphDir,
  sampleDuration = 10,
  sampleFrequency = 99,
  perfDataFile: customPerfDataFile,
  keepPerfData = false,
}) => {
  const logger = (type, ...args) => {
    console[type](`[${moduleName}]`, ...args)
  }

  // --- 参数校验 ---
  if (!perfDir) {
    logger('error', 'perfDir cannot be empty')
    return
  }
  if (!flamegraphDir) {
    logger('error', 'flamegraphDir cannot be empty')
    return
  }

  // PID 必须为数字且为正整数
  const pidNum = Number(pid)
  if (!Number.isInteger(pidNum) || pidNum <= 0) {
    logger('error', `Invalid PID: ${pid} – must be a positive integer`)
    return
  }

  const finalDuration =
    typeof sampleDuration === 'number' && sampleDuration > 0
      ? sampleDuration
      : 10
  const finalFrequency =
    typeof sampleFrequency === 'number' && sampleFrequency > 0
      ? sampleFrequency
      : 99

  // 确保 perf 目录存在（用于默认路径，或自定义路径的父目录）
  try {
    await fs.ensureDir(perfDir)
    logger('info', `Perf directory ready: ${perfDir}`)
  } catch (err) {
    logger('error', `Failed to create perf directory: ${err.message}`)
    return
  }

  // 检查  perf 权限
  try {
    const execa = await getExeca()

    await execa('perf', ['--version'], { timeout: 5000 })

    logger('info', 'Perf permission check passed')
  } catch (err) {
    logger('error', `Perf permission check failed: ${err.message}`)
    logger(
      'error',
      `Please ensure the perf command is installed and the user has permission to run it.\n
        You can configure the system to allow non-root perf by setting:\n
          "echo -1 | sudo tee /proc/sys/kernel/perf_event_paranoid"\n
          "sudo setcap cap_sys_admin+ep $(which perf)"`,
    )
    return // 无权限则直接退出
  }

  // 生成时间戳（仅当需要默认路径时）
  const timestamp = getSafeTimestamp()

  // 确定 perf 数据文件路径
  let perfDataFile
  if (customPerfDataFile) {
    perfDataFile = customPerfDataFile
    // 确保自定义路径的父目录存在
    const parentDir = path.dirname(perfDataFile)
    try {
      await fs.ensureDir(parentDir)
    } catch (err) {
      logger(
        'error',
        `Failed to create directory for custom perfDataFile: ${err.message}`,
      )
      return
    }
  } else {
    perfDataFile = path.join(perfDir, `perf.${pidNum}.${timestamp}.data`)
  }

  // 定义其他文件路径（基于 perfDir 和时间戳，与 perfDataFile 解耦）
  const perfStacksFile = path.join(
    perfDir,
    `perf.${pidNum}.${timestamp}.stacks`,
  )
  const perfFoldedFile = path.join(
    perfDir,
    `perf.${pidNum}.${timestamp}.folded`,
  )
  const perfSvgFile = path.join(perfDir, `perf.${pidNum}.${timestamp}.svg`)

  try {
    logger(
      'info',
      `PID:${pidNum} Starting perf sampling (${finalDuration}s, ${finalFrequency}Hz)`,
    )

    // --- Step 1: perf record ---
    const recordOk = await execCommand('perf', [
      'record',
      '-o',
      perfDataFile,
      '-F',
      String(finalFrequency),
      '-p',
      String(pidNum),
      '-g',
      '--',
      'sleep',
      String(finalDuration),
    ])
    if (!recordOk) return

    // --- Step 2: perf script 导出为文本堆栈 ---
    const scriptOk = await execCommand('perf', ['script', '-i', perfDataFile], {
      stdout: {
        file: perfStacksFile,
      },
    })

    if (!scriptOk) return

    logger('info', `PID:${pidNum} Perf sampling completed: ${perfStacksFile}`)

    // 根据 keepPerfData 决定是否删除原始数据文件
    if (!keepPerfData) {
      await fs.remove(perfDataFile).catch(() => {})
    }

    // --- Step 3: 检查火焰图工具 ---
    const stackcollapsePath = path.join(flamegraphDir, 'stackcollapse-perf.pl')
    const flamegraphPath = path.join(flamegraphDir, 'flamegraph.pl')

    const isStackcollapseValid = await fs
      .access(stackcollapsePath, fs.constants.X_OK)
      .then(() => true)
      .catch(() => false)
    const isFlamegraphValid = await fs
      .access(flamegraphPath, fs.constants.X_OK)
      .then(() => true)
      .catch(() => false)

    if (isStackcollapseValid && isFlamegraphValid) {
      // --- Step 4: 生成折叠文件 ---
      const collapseOk = await execCommand(
        stackcollapsePath,
        [perfStacksFile],
        {
          stdout: {
            file: perfFoldedFile,
          },
        },
      )
      if (!collapseOk) return

      // --- Step 5: 生成 SVG 火焰图 ---
      const flameOk = await execCommand(flamegraphPath, [perfFoldedFile], {
        stdout: {
          file: perfSvgFile,
        },
      })
      if (flameOk) {
        logger('info', `PID:${pidNum} Flame graph generated: ${perfSvgFile}`)
      }
    } else {
      const missing = []
      if (!isStackcollapseValid) missing.push('stackcollapse-perf.pl')
      if (!isFlamegraphValid) missing.push('flamegraph.pl')
      logger(
        'info',
        `PID:${pidNum} Skip flame graph – missing/not executable: ${missing.join(', ')}`,
      )
    }
  } catch (err) {
    logger('error', `PID:${pidNum} Perf sampling exception: ${err.message}`)
  }
}

module.exports = { performPerfSampling }
