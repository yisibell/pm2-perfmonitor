const fs = require('fs-extra')
const path = require('path')
const { execaCommand } = require('execa')

/**
 * Execute Perf sampling and generate flame graph (called before CPU overload restart)
 * @param {Object} options - Sampling configuration
 * @param {number} options.pid - Process PID (validity guaranteed externally)
 * @param {string} options.moduleName - Module name (for log prefix)
 * @param {string} options.perfDir - Perf file storage directory (required)
 * @param {string} options.flamegraphDir - Flame graph tool directory (required)
 * @param {number} [options.sampleDuration=10] - Perf sampling duration (seconds, default 10)
 * @param {number} [options.sampleFrequency=99] - Perf sampling frequency (Hz, default 99)
 */
const performPerfSampling = async ({
  pid,
  moduleName,
  perfDir,
  flamegraphDir,
  sampleDuration = 10,
  sampleFrequency = 99,
}) => {
  // Unified logger (consistent with main program)
  const logger = (type, ...args) => {
    console[type](`[${moduleName}]`, ...args)
  }

  /**
   * Internal utility function to execute shell commands
   * @param {string} cmd - Shell command to execute
   * @returns {boolean} Whether the command executed successfully
   */
  const execShellCommand = async (cmd) => {
    try {
      await execaCommand(cmd, {
        stdio: 'inherit',
        shell: true,
        timeout: sampleDuration * 1000 + 5000,
      })
      return true
    } catch (err) {
      logger(
        'error',
        `Command execution failed [Exit code: ${err.exitCode}]: ${cmd}`,
        err.message,
      )
      return false
    }
  }

  // Validate required path parameters
  if (!perfDir) {
    logger(
      'error',
      'perfDir parameter cannot be empty (Perf file storage directory)',
    )
    return
  }
  if (!flamegraphDir) {
    logger(
      'error',
      'flamegraphDir parameter cannot be empty (Flame graph tool directory)',
    )
    return
  }

  // Validate sampling parameters (fallback to default if invalid)
  const finalDuration =
    typeof sampleDuration === 'number' && sampleDuration > 0
      ? sampleDuration
      : 10
  const finalFrequency =
    typeof sampleFrequency === 'number' && sampleFrequency > 0
      ? sampleFrequency
      : 99

  // Ensure Perf directory exists
  try {
    await fs.ensureDir(perfDir)
    logger('info', `Perf directory is ready: ${perfDir}`)
  } catch (dirErr) {
    logger('error', `Failed to create Perf directory: ${dirErr.message}`)
    return
  }

  // Generate stable timestamp
  const TS = new Date()
    .toLocaleString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/[-:/]/g, '')
    .replace(', ', '_')

  // Define file paths
  const perfStacksFile = path.join(perfDir, `perf.${pid}.${TS}.stacks`)
  const perfFoldedFile = path.join(perfDir, `perf.${pid}.${TS}.folded`)
  const perfSvgFile = path.join(perfDir, `perf.${pid}.${TS}.svg`)

  // Core sampling process
  try {
    logger(
      'info',
      `PID:${pid} Starting Perf sampling (${finalDuration}s, frequency ${finalFrequency}Hz)`,
    )

    // Step 1: Execute Perf sampling
    const perfRecordSuccess = await execShellCommand(
      `sudo perf record -F ${finalFrequency} -p ${pid} -g -- sleep ${finalDuration}`,
    )
    if (!perfRecordSuccess) return

    // Step 2: Export Perf script
    const perfScriptSuccess = await execShellCommand(
      `sudo perf script > ${perfStacksFile}`,
    )
    if (!perfScriptSuccess) return

    logger('info', `PID:${pid} Perf sampling completed: ${perfStacksFile}`)

    // Clean up Perf temporary file ?
    // await execShellCommand('rm -f perf.data')

    // Step 3: Check flame graph tools (only log if not exist, skip flame graph generation)
    const stackcollapsePath = path.join(flamegraphDir, 'stackcollapse-perf.pl')
    const flamegraphPath = path.join(flamegraphDir, 'flamegraph.pl')

    const isStackcollapseValid =
      fs.existsSync(stackcollapsePath) &&
      fs.statSync(stackcollapsePath).mode & 0o111
    const isFlamegraphValid =
      fs.existsSync(flamegraphPath) && fs.statSync(flamegraphPath).mode & 0o111

    // Only generate flame graph if both tools are valid
    if (isStackcollapseValid && isFlamegraphValid) {
      // Generate folded file
      const collapseSuccess = await execShellCommand(
        `${stackcollapsePath} ${perfStacksFile} > ${perfFoldedFile}`,
      )
      if (!collapseSuccess) return

      // Generate SVG flame graph
      const flamegraphSuccess = await execShellCommand(
        `${flamegraphPath} ${perfFoldedFile} > ${perfSvgFile}`,
      )
      if (flamegraphSuccess) {
        logger(
          'info',
          `PID:${pid} Flame graph generated successfully: ${perfSvgFile}`,
        )
      }
    } else {
      // Only log prompt, do NOT block other processes (core requirement)
      const missingTools = []
      if (!isStackcollapseValid) missingTools.push('stackcollapse-perf.pl')
      if (!isFlamegraphValid) missingTools.push('flamegraph.pl')
      logger(
        'info',
        `PID:${pid} Skip flame graph generation - Missing or non-executable tools: ${missingTools.join(', ')} (Directory: ${flamegraphDir})`,
      )
    }
  } catch (err) {
    logger(
      'error',
      `PID:${pid} Perf sampling process exception: ${err.message}`,
    )
  }
}

// Export function for external use
module.exports = { performPerfSampling }
