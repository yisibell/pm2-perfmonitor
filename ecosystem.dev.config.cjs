/**
 * @type { { apps: import('pm2').StartOptions[] } }
 */
module.exports = {
  apps: [
    {
      name: 'app2',
      script: './test/test.js',
      exec_mode: 'cluster',
      instances: 4,
    },
    {
      name: 'pm2-perfmonitor',
      script: './lib/app.js', // 你的模块入口
      watch: true, // 手动开启监听
      ignore_watch: ['node_modules', '.git'],
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
}
