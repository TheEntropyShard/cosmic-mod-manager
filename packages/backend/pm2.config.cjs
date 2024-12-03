const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config({ path: "./.env" });

const isDev = process.env.NODE_ENV === "development";

const rootDir = "/var/www/cosmic-mod-manager"; // The dir in which the repo will be cloned in prod

const sourceDir = isDev === false ? `${rootDir}/source` : "/home/abhinav/Code/Monorepos/cosmic-mod-manager"; // The actual root of the project
const backendDir = `${sourceDir}/packages/backend`; // Root of the backend
const frontendDir = "/var/www/cosmic-mod-manager/packages/frontend"; // Root of the frontend

const reloadBackend =
    "pm2 reload pm2.config.cjs --only crmm-meilisearch && pm2 reload pm2.config.cjs --only crmm-redis && pm2 reload pm2.config.cjs --only crmm-backend";
const reloadFrontend = "pm2 reload pm2.config.cjs --only crmm-frontend";

const dev_backend = {
    name: "crmm-backend",
    command: "bun run dev",
    cwd: backendDir,
    autorestart: true,
    watch: false,
};

const prod_backend = {
    name: "crmm-backend",
    script: "src/index.ts",
    interpreter: "bun",
    cwd: backendDir,
    autorestart: true,
    watch: false,
};

const prod_frontend = {
    name: "crmm-frontend",
    command: "bun run start",
    cwd: frontendDir,
    autorestart: true,
    watch: false,
};

const apps = [
    {
        name: "crmm-meilisearch",
        command: "/usr/bin/meilisearch",
        args: ["--master-key", `${process.env.MEILISEARCH_MASTER_KEY}`],
        cwd: `${backendDir}/meilisearch`,
        autorestart: true,
        watch: false,
    },
    {
        name: "crmm-redis",
        command: "/usr/bin/redis-server",
        args: ["--port", "5501"],
        cwd: `${backendDir}/redis`,
        autorestart: true,
        watch: false,
    },
    isDev ? dev_backend : prod_backend,
];

if (!isDev) {
    apps.push(prod_frontend);
}

module.exports = {
    apps: apps,
    deploy: {
        prod_backend: {
            user: `${process.env.SSH_USER}`,
            host: [`${process.env.SSH_HOST}`],
            key: `${process.env.SSH_KEY}`,
            ref: "origin/main",
            repo: "https://github.com/CRModders/cosmic-mod-manager.git",
            path: rootDir,
            "post-deploy": `cd ${backendDir} && bun install && bun run prisma-generate && bun run prisma-push && ${reloadBackend}`,
        },
        prod_frontend: {
            user: `${process.env.SSH_USER}`,
            host: [`${process.env.SSH_HOST}`],
            key: `${process.env.SSH_KEY}`,
            ref: "origin/main",
            repo: "https://github.com/CRModders/cosmic-mod-manager.git",
            path: rootDir,
            "post-deploy": `cd ${frontendDir} && bun install && bun run build && ${reloadFrontend}`,
        },
    },
};
