import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeTelegramBot, shutdownTelegramBot } from "./bot";
import { fixtureScheduler } from "./scheduler";
import { PlayerScheduler } from "./playerScheduler";
import { historicalDataScheduler } from "./historicalDataScheduler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize Telegram Bot if token is provided
    const botToken = process.env.BOT_TOKEN;
    if (botToken) {
      try {
        await initializeTelegramBot(botToken);
        log('🤖 Telegram bot initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Telegram bot:', error);
        log('⚠️  Telegram bot initialization failed - continuing without bot');
      }
    } else {
      log('⚠️  BOT_TOKEN environment variable not found - Telegram bot disabled');
      log('   To enable the bot, set BOT_TOKEN environment variable with your bot token');
    }

    // Start fixture scheduler
    try {
      await fixtureScheduler.start();
      log('📅 Fixture scheduler started successfully');
    } catch (error) {
      console.error('❌ Failed to start fixture scheduler:', error);
      log('⚠️  Fixture scheduler initialization failed');
    }

    // Start player data scheduler
    try {
      const playerScheduler = new PlayerScheduler();
      await playerScheduler.start();
      log('👥 Player data scheduler started successfully');
    } catch (error) {
      console.error('❌ Failed to start player scheduler:', error);
      log('⚠️  Player scheduler initialization failed');
    }

    // Start historical data scheduler
    try {
      historicalDataScheduler.start();
      log('📊 Historical data scheduler started successfully');
    } catch (error) {
      console.error('❌ Failed to start historical data scheduler:', error);
      log('⚠️  Historical data scheduler initialization failed');
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log('🛑 Received SIGTERM, shutting down gracefully');
    await shutdownTelegramBot();
    await fixtureScheduler.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log('🛑 Received SIGINT, shutting down gracefully');
    await shutdownTelegramBot();
    await fixtureScheduler.stop();
    process.exit(0);
  });
})();
