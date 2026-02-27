/**
 * @type { { apps: import('pm2').StartOptions[] } }
 */
module.exports = {
  apps: [
    {
      name: 'app1',
      script: './test/test.js',
      exec_mode: 'cluster',
      instances: 4,
    },
  ],
}
