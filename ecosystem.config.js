module.exports = {
    apps: [
        {
            name: 'resume-backend-web',
            script: 'src/server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 8080
            }
        },
        {
            name: 'resume-backend-worker',
            script: 'src/worker-manager.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                ROLE: 'worker'
            }
        }
    ]
};
