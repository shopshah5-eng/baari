// PM2 (no Docker path). `pm2 start deploy/ecosystem.config.js`
module.exports = {
  apps: [{
    name: 'baari',
    script: 'src/server.js',
    instances: 1,                 // Baileys sessions are stateful → keep 1 per host
    exec_mode: 'fork',
    max_memory_restart: '700M',
    env: { NODE_ENV: 'production', PORT: 3000 },
    out_file: 'data/logs/out.log',
    error_file: 'data/logs/err.log',
    time: true,
    restart_delay: 3000
  }]
};
