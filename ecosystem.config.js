module.exports = {
    apps: [
        {
            name: 'smart-factory-backend',
            script: './dist/index.js',
            instances: 'max', // Use all available CPU cores
            exec_mode: 'cluster', // Enable cluster mode for load balancing
            env: {
                NODE_ENV: 'production',
                PORT: 3011,
                NODE_CLUSTER_MODE: 'sticky' // Enable sticky sessions for cluster mode
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3011,
                NODE_CLUSTER_MODE: 'sticky' // Enable sticky sessions for cluster mode
            },
            env_development: {
                NODE_ENV: 'development',
                PORT: 3011,
                NODE_CLUSTER_MODE: 'sticky' // Enable sticky sessions for cluster mode
            },
            // Restart policies
            max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
            restart_delay: 4000, // Delay between restarts
            max_restarts: 10, // Maximum restart attempts
            min_uptime: '10s', // Minimum uptime before considering restart successful

            // Logging
            log_file: './logs/combined.log',
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Process management
            pid_file: './pids/smart-factory-backend.pid',
            watch: false, // Disable file watching in production
            ignore_watch: ['node_modules', 'logs', 'uploads'],

            // Graceful shutdown
            kill_timeout: 5000, // Wait 5 seconds for graceful shutdown
            wait_ready: true,
            listen_timeout: 10000, // Wait 10 seconds for app to listen

            // Environment variables that should be set externally
            env_vars: [
                'MONGODB_URI',
                'JWT_SECRET',
                'MQTT_BROKER_URL',
                'MQTT_USERNAME',
                'MQTT_PASSWORD',
                'CORS_ORIGIN'
            ]
        }
    ],
};