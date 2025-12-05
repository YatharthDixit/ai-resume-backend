module.exports = {
    apps: [
        {
            name: 'resume-backend-web',
            script: 'src/server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            // Log configuration
            out_file: './logs/web-out.log',
            error_file: './logs/web-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true
        },
        {
            name: 'resume-backend-worker',
            script: 'src/worker-manager.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            // Log configuration
            out_file: './logs/worker-out.log',
            error_file: './logs/worker-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true
        }
    ]
};
