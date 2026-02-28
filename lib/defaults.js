const defaultOptions = {
  enabled: true,
  /**
   * 排除的 app 名
   */
  excludeApps: [],
  /**
   * 包含的 app 名
   */
  includeApps: [],
  /**
   * 定时检测间隔（ms）
   */
  workerInterval: 60000,
  /**
   * 是否开启僵尸进程守护
   */
  zombieDetection: true,
  /**
   * 僵尸状态最大出现次数
   */
  zombieMaxHits: 10,
  /**
   * 僵尸状态达到最大容忍度时，是否自动重启僵尸进程
   */
  autoRestartWhenZombieDetected: true,
  /**
   * 僵尸进程最大重启次数，设置为0表示不限制
   */
  zombieMaxRestarts: 0,
}

module.exports = {
  defaultOptions,
}
