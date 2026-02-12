module.exports = {
  apps: [
    {
      name: 'app1',
      script: './test/test.js',
      mode: 'cluster',
      instances: 4,
    },
  ],
}
