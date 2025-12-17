/**
 * ⚠️ DEPRECATED: This PM2 configuration is no longer used.
 * The application now uses Node.js Cluster Module for process management.
 * 
 * To start the application:
 *   npm run build && npm start
 * 
 * To configure cluster workers, set CLUSTER_WORKERS environment variable
 * (defaults to number of CPU cores if not set)
 * 
 * This file is kept for reference only.
 */
module.exports = {
    apps: [
        {
            name: "PM_BE",
            script: "npm",
            args: "start",
            exec_mode: "cluster",
            instances: "max",        // or a number like 4
            watch: false,
            env: {
                NODE_ENV: "production",
            },
            node_args: "--require ts-node/register",
            // Sticky session for websockets / sessions
            // Available only when exec_mode = "cluster"
            sticky: true
        }
    ],

    deploy: {
        production: {
            user: "ubuntu",
            host: "YOUR_SERVER_IP",
            ref: "origin/main",
            repo: "YOUR_GIT_REPO_URL",
            path: "/var/www/your-app",
            ssh_options: "StrictHostKeyChecking=no",

            // ✔ Runs *before* PM2 reload/restart
            "pre-deploy-local": "",

            // ---------------------------------
            // Your custom preparation steps
            // ---------------------------------
            // This section will run ON THE SERVER during deploy:
            // stash → pull → update api_spec → npm install → build
            "pre-deploy": [
                "git stash",
                "git pull origin main",
                "cd api_spec && git pull origin main && cd ..",
                "npm install",
                "npm run build"
            ].join(" && "),

            // Automatically restart using the PM2 app name above
            "post-deploy":
                "pm2 reload ecosystem.config.js --only PM_BE"
        }
    }
}
