const path = require('node:path')

/**
 * @type { { apps: import('pm2').StartOptions[] } }
 */
module.exports = {
  apps: [
    {
      name: 'app3',
      script: path.resolve(process.cwd(), './example-apps/server.mjs'),
      exec_mode: 'cluster',
      instances: 4,
      env: {
        PORT: 3003,
      },
    },
  ],
}
