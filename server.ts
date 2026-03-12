import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database;
try {
  db = new Database("shop.db");
  console.log("Database initialized successfully");
} catch (err) {
  console.error("Failed to initialize database, using in-memory fallback:", err);
  db = new Database(":memory:");
}

// Initialize Database
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'visit', 'view'
      product_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_stats_type ON stats(type);
    CREATE INDEX IF NOT EXISTS idx_stats_product_id ON stats(product_id);
  `);

  // Migration: Add product_id if it doesn't exist (for existing databases)
  try {
    db.prepare("SELECT product_id FROM stats LIMIT 1").get();
  } catch (e) {
    console.log("Adding product_id column to stats table...");
    db.exec("ALTER TABLE stats ADD COLUMN product_id INTEGER");
  }
} catch (err) {
  console.error("Error setting up database schema:", err);
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '100mb' }));

  // API to log visit (more reliable than socket for mobile)
  app.post("/api/visit", (req, res) => {
    try {
      db.prepare("INSERT INTO stats (type) VALUES (?)").run("visit");
      res.json({ success: true });
    } catch (e) {
      console.error("Error logging visit via API:", e);
      res.status(500).json({ error: "Failed to log visit" });
    }
  });

  app.post("/api/view", (req, res) => {
    try {
      const { productId } = req.body;
      db.prepare("INSERT INTO stats (type, product_id) VALUES (?, ?)").run("view", productId);
      res.json({ success: true });
    } catch (e) {
      console.error("Error logging view via API:", e);
      res.status(500).json({ error: "Failed to log view" });
    }
  });

  // API Routes
  app.get("/api/stats", (req, res) => {
    try {
      const totalVisits = db.prepare("SELECT COUNT(*) as count FROM stats WHERE type = 'visit'").get()?.count || 0;
      const totalViews = db.prepare("SELECT COUNT(*) as count FROM stats WHERE type = 'view'").get()?.count || 0;
      
      // Get most viewed products from local stats
      const mostViewed = db.prepare(`
        SELECT product_id as id, COUNT(*) as views 
        FROM stats 
        WHERE type = 'view' AND product_id IS NOT NULL 
        GROUP BY product_id 
        ORDER BY views DESC 
        LIMIT 5
      `).all();
      
      res.json({ totalVisits, totalViews, mostViewed, onlineUsers: 0 });
    } catch (error) {
      console.error("Error fetching stats from SQLite:", error);
      res.status(500).json({ error: "Internal server error", onlineUsers: 0 });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
