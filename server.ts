import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("shop.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'visit', 'view'
    product_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json({ limit: '100mb' }));

  // Real-time presence
  let onlineUsers = 0;
  io.on("connection", (socket) => {
    onlineUsers++;
    io.emit("presence_update", onlineUsers);
    
    // Log visit
    db.prepare("INSERT INTO stats (type) VALUES (?)").run("visit");

    socket.on("disconnect", () => {
      onlineUsers--;
      io.emit("presence_update", onlineUsers);
    });
  });

  // API Routes
  app.get("/api/stats", (req, res) => {
    const totalVisits = db.prepare("SELECT COUNT(*) as count FROM stats WHERE type = 'visit'").get().count;
    const totalViews = db.prepare("SELECT COUNT(*) as count FROM stats WHERE type = 'view'").get().count;
    
    // Note: products views are now handled in Supabase, but we can still show a placeholder or 
    // fetch from Supabase if needed. For now, we'll return empty mostViewed to keep it simple.
    res.json({ totalVisits, totalViews, mostViewed: [], onlineUsers });
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

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
