import "../env";
import { bootstrapApp } from "./app";
import { logEvent } from "./observability/logger";

async function startServer() {
  const { httpServer } = await bootstrapApp();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      logEvent("info", "server_started", {
        port,
        environment: process.env.NODE_ENV ?? "development",
      });
    },
  );
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
