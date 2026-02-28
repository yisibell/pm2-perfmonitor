const path = require('node:path')

/**
 * @type { { apps: import('pm2').StartOptions[] } }
 */
module.exports = {
  apps: [
    {
      name: 'app3',
      script: path.resolve(process.cwd(), './test/server.js'),
      exec_mode: 'cluster',
      instances: 4,
      env: {
        PORT: 3003,
      },
    },
  ],
}
