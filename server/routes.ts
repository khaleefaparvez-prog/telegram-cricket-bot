import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeTelegramBot, shutdownTelegramBot, telegramBot } from "./bot";
import { insertBotSettingsSchema, insertFixtureSchema } from "@shared/schema";
import { fixtureScheduler } from "./scheduler";
import { OptimizedCricketPredictor } from "./optimizedPredictor";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize optimized predictor
  const optimizedPredictor = new OptimizedCricketPredictor(storage);

  // Health check endpoint for Docker healthchecks
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
  });

  // Optimized Prediction API Endpoints
  app.post("/api/predict/fast", async (req, res) => {
    try {
      const input = req.body; // Should contain PredictionInput
      const prediction = await optimizedPredictor.generateFastPrediction(storage, input);
      res.json(prediction);
    } catch (error) {
      console.error("Fast prediction error:", error);
      res.status(500).json({ error: "Failed to generate fast prediction" });
    }
  });

  app.post("/api/predict/balanced", async (req, res) => {
    try {
      const input = req.body;
      const prediction = await optimizedPredictor.generateBalancedPrediction(storage, input);
      res.json(prediction);
    } catch (error) {
      console.error("Balanced prediction error:", error);
      res.status(500).json({ error: "Failed to generate balanced prediction" });
    }
  });

  app.post("/api/predict/smart", async (req, res) => {
    try {
      const input = req.body;
      const mode = req.query.mode as 'fast' | 'balanced' | 'smart' || 'smart';
      const prediction = await optimizedPredictor.predict(storage, input, mode);
      res.json(prediction);
    } catch (error) {
      console.error("Smart prediction error:", error);
      res.status(500).json({ error: "Failed to generate smart prediction" });
    }
  });

  // Cache management endpoints
  app.post("/api/predict/cache/clear", async (req, res) => {
    try {
      optimizedPredictor.clearCache();
      res.json({ message: "Prediction cache cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  app.get("/api/predict/cache/stats", async (req, res) => {
    try {
      const stats = optimizedPredictor.getCacheStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get cache stats" });
    }
  });

  // Bot Settings API
  app.get("/api/bot/settings", async (req, res) => {
    try {
      const settings = await storage.getBotSettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching bot settings:", error);
      res.status(500).json({ error: "Failed to fetch bot settings" });
    }
  });

  app.post("/api/bot/settings", async (req, res) => {
    try {
      const validatedData = insertBotSettingsSchema.parse(req.body);
      
      const existing = await storage.getBotSettings();
      let settings;
      
      if (existing) {
        settings = await storage.updateBotSettings(validatedData);
      } else {
        settings = await storage.createBotSettings(validatedData);
      }
      
      // Restart bot with new token if provided
      if (validatedData.botToken && validatedData.botToken !== existing?.botToken) {
        try {
          await shutdownTelegramBot();
          await initializeTelegramBot(validatedData.botToken);
        } catch (botError) {
          console.error("Failed to restart bot:", botError);
          // Don't fail the settings update if bot restart fails
        }
      }

      // Update scheduler if update interval changed
      if (validatedData.updateInterval && validatedData.updateInterval !== existing?.updateInterval) {
        try {
          await fixtureScheduler.updateSchedule(validatedData.updateInterval);
        } catch (scheduleError) {
          console.error("Failed to update scheduler:", scheduleError);
        }
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error saving bot settings:", error);
      res.status(400).json({ error: "Invalid settings data" });
    }
  });

  app.post("/api/bot/start", async (req, res) => {
    try {
      const settings = await storage.getBotSettings();
      
      if (!settings?.botToken) {
        return res.status(400).json({ error: "Bot token not configured" });
      }
      
      if (telegramBot) {
        return res.json({ message: "Bot is already running" });
      }
      
      await initializeTelegramBot(settings.botToken);
      res.json({ message: "Bot started successfully" });
    } catch (error) {
      console.error("Error starting bot:", error);
      res.status(500).json({ error: "Failed to start bot" });
    }
  });

  app.post("/api/bot/stop", async (req, res) => {
    try {
      await shutdownTelegramBot();
      res.json({ message: "Bot stopped successfully" });
    } catch (error) {
      console.error("Error stopping bot:", error);
      res.status(500).json({ error: "Failed to stop bot" });
    }
  });

  app.get("/api/bot/status", async (req, res) => {
    try {
      const isRunning = telegramBot !== null;
      const settings = await storage.getBotSettings();
      
      res.json({
        isRunning,
        hasToken: !!settings?.botToken,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error checking bot status:", error);
      res.status(500).json({ error: "Failed to check bot status" });
    }
  });

  // Fixtures refresh API
  app.post("/api/fixtures/refresh", async (req, res) => {
    try {
      const syncedCount = await fixtureScheduler.triggerSync();
      res.json({ 
        message: "Fixtures refreshed successfully",
        syncedCount 
      });
    } catch (error) {
      console.error("Error refreshing fixtures:", error);
      res.status(500).json({ error: "Failed to refresh fixtures" });
    }
  });

  // Fixtures API
  app.get("/api/fixtures", async (req, res) => {
    try {
      const { sport, category } = req.query;
      const fixtures = await storage.getFixtures(
        sport as string, 
        category as string
      );
      res.json(fixtures);
    } catch (error) {
      console.error("Error fetching fixtures:", error);
      res.status(500).json({ error: "Failed to fetch fixtures" });
    }
  });

  app.post("/api/fixtures", async (req, res) => {
    try {
      const validatedData = insertFixtureSchema.parse(req.body);
      const fixture = await storage.createFixture(validatedData);
      res.json(fixture);
    } catch (error) {
      console.error("Error creating fixture:", error);
      res.status(400).json({ error: "Invalid fixture data" });
    }
  });

  app.put("/api/fixtures/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertFixtureSchema.partial().parse(req.body);
      const fixture = await storage.updateFixture(id, validatedData);
      
      if (!fixture) {
        return res.status(404).json({ error: "Fixture not found" });
      }
      
      res.json(fixture);
    } catch (error) {
      console.error("Error updating fixture:", error);
      res.status(400).json({ error: "Invalid fixture data" });
    }
  });

  app.delete("/api/fixtures/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFixture(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Fixture not found" });
      }
      
      res.json({ message: "Fixture deleted successfully" });
    } catch (error) {
      console.error("Error deleting fixture:", error);
      res.status(500).json({ error: "Failed to delete fixture" });
    }
  });

  // Dashboard stats API
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const allFixtures = await storage.getFixtures();
      
      const stats = {
        totalFixtures: allFixtures.length,
        liveMatches: allFixtures.filter(f => f.status === "live").length,
        upcomingMatches: allFixtures.filter(f => f.status === "upcoming").length,
        completedMatches: allFixtures.filter(f => f.status === "completed").length,
        cricketFixtures: allFixtures.filter(f => f.sport === "cricket").length,
        tennisFixtures: allFixtures.filter(f => f.sport === "tennis").length,
        lastUpdated: new Date().toISOString()
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
