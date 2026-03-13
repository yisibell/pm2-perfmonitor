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

  /**
   * 是否开启 CPU 过载守护
   */
  cpuOverloadDetection: false,

  /**
   * 判定 CPU 过载阈值
   */
  cpuOverloadThreshold: 90,

  /**
   * 允许 CPU 过载最大连续出现次数，达到时自动重启
   */
  cpuOverloadMaxHits: 5,

  /**
   * 是否开启 perf 性能采集
   */
  enablePerfCollection: false,

  /**
   * 性能报告生成目录
   */
  perfReportGenerationDir: '/var/log/pm2/perf',

  /**
   * flamegraph 火焰图生成工具目录
   */
  flamegraphDir: '/opt/FlameGraph',

  /**
   * perf 采样持续时间 (s)
   */
  perfSampleDuration: 10,

  /**
   * perf 采样频率 (Hz)
   */
  perfSampleFrequency: 99,

  /**
   * 是否开启 node:inspector 性能采集
   */
  enableNodeInspectorCollection: false,

  /**
   * node:inspector 性能采集持续时间 (s)
   */
  nodeInspectorSampleDuration: 10,

  /**
   * 指定是否开启报警
   */
  enableAlert: false,
  /**
   * 指定报警执行 bash 脚本位置
   */
  alertCmdPath: '/var/job/alert.sh',
  /**
   * 指定报警环境类别
   */
  alertEnv: 'prod',
  /**
   * 指定报警级别
   */
  alertLevel: 'Sev-2',
}

module.exports = {
  defaultOptions,
}
