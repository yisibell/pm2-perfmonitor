import fs from 'node:fs'
import path from 'node:path'

/**
 * @param {string} filePath
 * @returns { { success: boolean, data: string | null }}
 */
const readFileContent = (filePath) => {
  try {
    const absolutePath = path.resolve(filePath)
    const data = fs.readFileSync(absolutePath, 'utf8')
    return { success: true, data }
  } catch {
    return {
      success: false,
      data: null,
    }
  }
}

/**
 * @param {string} path
 */
const getJobConfHostName = (path) => {
  const result = readFileContent(path)

  if (result.success && result.data) {
    const arr = result.data.split('=')

    return arr[1]
  }

  return 'unknown'
}

module.exports = {
  readFileContent,
  getJobConfHostName,
}
