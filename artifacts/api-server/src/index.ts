const useSQLite = process.env.DATABASE_PROVIDER === "sqlite";
const { default: app } = await import(useSQLite ? "./local-sqlite" : "./app");
const { logger } = useSQLite ? { logger: console } : await import("./lib/logger");

export {};

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port, database: useSQLite ? "sqlite" : "postgres" }, "Server listening");
});

server.on("error", (err: Error) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
