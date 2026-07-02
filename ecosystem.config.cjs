// pm2 process config for running the coach app 24/7 (e.g. on a small server).
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup   # keep it running after reboot
module.exports = {
  apps: [
    {
      name: 'coach-app',
      script: 'src/server.js',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
