// pm2 process config for running the assistant 24/7.
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup   # keep it running after reboot
module.exports = {
  apps: [
    {
      name: 'claude-assistant',
      script: 'src/app.js',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
