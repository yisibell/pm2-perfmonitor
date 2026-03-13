const { getExeca } = require('./execa-helper')

/**
 * 发送警告
 * @param { object } options
 * @param { string } options.cmd - bash 脚本 path（默认值：/var/job/alert.sh）
 * @param { string } options.env - 环境（默认值: prod）
 * @param { string } options.level - 报警级别（默认值: Sev-2）
 * @param { string } options.title - 报警标题
 * @param { string } options.content - 报警正文
 */
const sendAlert = async (options) => {
  try {
    const execa = await getExeca()

    const args = [options.env, options.level, options.title, options.content]

    await execa(options.cmd, args)

    return true
  } catch (err) {
    console.error('[Send Alert Error]:', err)
    return false
  }
}

module.exports = {
  sendAlert,
}
