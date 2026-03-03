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
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    images TEXT, -- JSON array of URLs/base64
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'visit', 'view'
    product_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,
    phone TEXT,
    images TEXT,
    is_placeholder BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed data if empty
const reviewsCount = db.prepare("SELECT COUNT(*) as count FROM reviews").get().count;
if (reviewsCount === 0) {
  const names = ["Олександр", "Марія", "Іван", "Олена", "Дмитро", "Тетяна", "Андрій", "Оксана", "Сергій", "Наталія"];
  const comments = [
    "Чудові диски, якість на висоті!",
    "Швидка доставка, рекомендую.",
    "Дуже задоволений покупкою, виглядають круто.",
    "Найкращий сервіс в Україні.",
    "Все підійшло ідеально, дякую!",
    "Великий вибір та приємні ціни.",
    "Професійна консультація, допомогли з вибором.",
    "Диски прийшли добре запаковані.",
    "Якісний товар за помірну ціну.",
    "Буду замовляти ще!"
  ];

  const insertReview = db.prepare("INSERT INTO reviews (user_name, rating, comment, created_at) VALUES (?, ?, ?, ?)");
  for (let i = 0; i < 50; i++) {
    const name = names[Math.floor(Math.random() * names.length)];
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const rating = 4 + Math.floor(Math.random() * 2);
    // Generate dates over the last 3 months
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    insertReview.run(name, rating, comment, date.toISOString());
  }
}

const adsCount = db.prepare("SELECT COUNT(*) as count FROM ads").get().count;
if (adsCount === 0) {
  const insertAd = db.prepare("INSERT INTO ads (title, description, price, phone, images, is_placeholder) VALUES (?, ?, ?, ?, ?, ?)");
  for (let i = 1; i <= 6; i++) {
    insertAd.run(
      `Оголошення #${i}`,
      "Тут може бути ваш опис товару. Продавайте свої диски швидко та вигідно!",
      5000 + i * 1000,
      "+380000000000",
      JSON.stringify(["https://picsum.photos/seed/wheel" + i + "/400/400"]),
      1
    );
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json({ limit: '50mb' }));

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
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
    res.json(products.map(p => ({ ...p, images: JSON.parse(p.images || "[]") })));
  });

  app.get("/api/products/:id", (req, res) => {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (product) {
      db.prepare("UPDATE products SET views = views + 1 WHERE id = ?").run(req.params.id);
      db.prepare("INSERT INTO stats (type, product_id) VALUES (?, ?)").run("view", req.params.id);
      res.json({ ...product, images: JSON.parse(product.images || "[]") });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.post("/api/products", (req, res) => {
    const { name, description, price, images } = req.body;
    const result = db.prepare(
      "INSERT INTO products (name, description, price, images) VALUES (?, ?, ?, ?)"
    ).run(name, description, price, JSON.stringify(images));
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/products/:id", (req, res) => {
    const { name, description, price, images } = req.body;
    db.prepare(
      "UPDATE products SET name = ?, description = ?, price = ?, images = ? WHERE id = ?"
    ).run(name, description, price, JSON.stringify(images), req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const totalVisits = db.prepare("SELECT COUNT(*) as count FROM stats WHERE type = 'visit'").get().count;
    const totalViews = db.prepare("SELECT COUNT(*) as count FROM stats WHERE type = 'view'").get().count;
    const mostViewed = db.prepare(`
      SELECT p.id, p.name, p.views 
      FROM products p 
      ORDER BY p.views DESC 
      LIMIT 5
    `).all();
    
    res.json({ totalVisits, totalViews, mostViewed, onlineUsers });
  });

  // Reviews API
  app.get("/api/reviews", (req, res) => {
    const reviews = db.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all();
    res.json(reviews);
  });

  app.post("/api/reviews", (req, res) => {
    const { user_name, rating, comment } = req.body;
    const result = db.prepare(
      "INSERT INTO reviews (user_name, rating, comment) VALUES (?, ?, ?)"
    ).run(user_name, rating, comment);
    res.json({ id: result.lastInsertRowid });
  });

  // Ads API
  app.get("/api/ads", (req, res) => {
    const ads = db.prepare("SELECT * FROM ads ORDER BY created_at DESC").all();
    res.json(ads.map(ad => ({ ...ad, images: JSON.parse(ad.images || "[]") })));
  });

  app.post("/api/ads", (req, res) => {
    const { title, description, price, phone, images, is_placeholder } = req.body;
    const result = db.prepare(
      "INSERT INTO ads (title, description, price, phone, images, is_placeholder) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(title, description, price, phone, JSON.stringify(images || []), is_placeholder ? 1 : 0);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/ads/:id", (req, res) => {
    db.prepare("DELETE FROM ads WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/generate-description", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      
      const { generateProductDescription } = await import("./src/services/geminiService.ts");
      const description = await generateProductDescription(name);
      
      res.json({ description });
    } catch (error: any) {
      console.error("Route error:", error);
      res.status(500).json({ error: error.message || "Помилка при генерації опису" });
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

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
