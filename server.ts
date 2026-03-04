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
    sku TEXT,
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

// Migration: Add sku column if it doesn't exist
try {
  db.prepare("SELECT sku FROM products LIMIT 1").get();
} catch (e) {
  console.log("Adding sku column to products table...");
  db.exec("ALTER TABLE products ADD COLUMN sku TEXT");
}

// Seed data if empty
const productsCount = db.prepare("SELECT COUNT(*) as count FROM products").get().count;
if (productsCount === 0) {
  const insertProduct = db.prepare("INSERT INTO products (name, description, price, images, sku) VALUES (?, ?, ?, ?, ?)");
  const seedProducts = [
    {
      name: "Vossen CVT Gloss Graphite",
      description: "Елегантні диски з направленим дизайном. Ідеально підходять для сучасних седанів.",
      price: 12500,
      images: ["https://images.unsplash.com/photo-1551522435-a13afa10f103?auto=format&fit=crop&q=80&w=800"],
      sku: "VS-CVT-01"
    },
    {
      name: "BBS Super RS Gold",
      description: "Класика, яка ніколи не вийде з моди. Трьохскладовий дизайн з золотистим центром.",
      price: 18900,
      images: ["https://images.unsplash.com/photo-1584345604480-8347bb9c56a0?auto=format&fit=crop&q=80&w=800"],
      sku: "BBS-RS-02"
    },
    {
      name: "Rotiform BLQ-C",
      description: "Унікальний сітчастий дизайн для тих, хто хоче виділятися.",
      price: 14200,
      images: ["https://images.unsplash.com/photo-1549399500-c44d172e9971?auto=format&fit=crop&q=80&w=800"],
      sku: "RT-BLQ-03"
    }
  ];

  for (const p of seedProducts) {
    insertProduct.run(p.name, p.description, p.price, JSON.stringify(p.images), p.sku);
  }
}

const reviewsCount = db.prepare("SELECT COUNT(*) as count FROM reviews").get().count;
if (reviewsCount === 0) {
  const names = [
    "Олександр", "Марія", "Іван", "Олена", "Дмитро", "Тетяна", "Андрій", "Оксана", "Сергій", "Наталія",
    "Віталій", "Юлія", "Максим", "Світлана", "Артем", "Ірина", "Денис", "Ольга", "Микола", "Анна",
    "Василь", "Вікторія", "Павло", "Людмила", "Євген", "Галина", "Роман", "Надія", "Тарас", "Валентина"
  ];
  const comments = [
    "Чудові диски, якість на висоті! Вже рік катаюсь, все супер.",
    "Швидка доставка, рекомендую цей магазин всім знайомим.",
    "Дуже задоволений покупкою, виглядають круто на моєму авто.",
    "Найкращий сервіс в Україні. Допомогли підібрати правильний виліт.",
    "Все підійшло ідеально, дякую за професійну консультацію!",
    "Великий вибір та приємні ціни. Буду звертатися ще.",
    "Професійна консультація, допомогли з вибором дисків для BMW.",
    "Диски прийшли добре запаковані, без жодних подряпин.",
    "Якісний товар за помірну ціну. Однозначно 5 зірок.",
    "Буду замовляти ще! Дуже задоволений відношенням до клієнта.",
    "Диски просто вогонь! Машина стала виглядати зовсім інакше.",
    "Дякую за оперативність. Замовив вчора, сьогодні вже на пошті.",
    "Якість фарбування вражає. Навіть після зими як нові.",
    "Приємно мати справу з професіоналами. Рекомендую!",
    "Найкращі ціни на оригінальні диски. Перевірено часом.",
    "Дуже ввічливий персонал. Все розказали і показали.",
    "Шукав саме такі диски дуже довго. Дякую, що знайшли їх для мене!",
    "Доставка в Одесу зайняла всього один день. Супер!",
    "Параметри підійшли ідеально, ніде не затирає.",
    "Задоволений на всі 100%. Кращого варіанту не знайти."
  ];

  const insertReview = db.prepare("INSERT INTO reviews (user_name, rating, comment, created_at) VALUES (?, ?, ?, ?)");
  
  // Start date: Jan 1, 2021
  const startDate = new Date('2021-01-01T00:00:00Z').getTime();
  // End date: Now
  const endDate = new Date().getTime();

  for (let i = 0; i < 50; i++) {
    const name = names[Math.floor(Math.random() * names.length)];
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const rating = 4 + Math.floor(Math.random() * 2); // 4 or 5 stars
    
    // Random date between 2021 and now
    const randomTimestamp = startDate + Math.random() * (endDate - startDate);
    const date = new Date(randomTimestamp);
    
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
    try {
      console.log("Incoming product data:", req.body);
      const { name, description, price, images, sku } = req.body;
      if (!name || price === undefined) {
        return res.status(400).json({ error: "Name and price are required" });
      }
      
      const imagesJson = Array.isArray(images) ? JSON.stringify(images) : JSON.stringify([]);
      
      const stmt = db.prepare(
        "INSERT INTO products (name, description, price, images, sku) VALUES (?, ?, ?, ?, ?)"
      );
      const result = stmt.run(name, description, price, imagesJson, sku || `AT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const { name, description, price, images, sku } = req.body;
      if (!name || price === undefined) {
        return res.status(400).json({ error: "Name and price are required" });
      }
      
      const imagesJson = Array.isArray(images) ? JSON.stringify(images) : JSON.stringify([]);
      
      const stmt = db.prepare(
        "UPDATE products SET name = ?, description = ?, price = ?, images = ?, sku = ? WHERE id = ?"
      );
      stmt.run(name, description, price, imagesJson, sku, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
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
    const { user_name, rating, comment, created_at } = req.body;
    const result = db.prepare(
      "INSERT INTO reviews (user_name, rating, comment, created_at) VALUES (?, ?, ?, ?)"
    ).run(user_name, rating, comment, created_at || new Date().toISOString());
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/reviews/bulk", (req, res) => {
    const reviews = req.body;
    if (!Array.isArray(reviews)) return res.status(400).json({ error: "Expected an array" });
    
    const insert = db.prepare("INSERT INTO reviews (user_name, rating, comment, created_at) VALUES (?, ?, ?, ?)");
    const insertMany = db.transaction((reviews) => {
      for (const review of reviews) {
        insert.run(review.user_name, review.rating, review.comment, review.created_at || new Date().toISOString());
      }
    });
    
    insertMany(reviews);
    res.json({ success: true, count: reviews.length });
  });

  app.delete("/api/reviews/:id", (req, res) => {
    db.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
    res.json({ success: true });
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
