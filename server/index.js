import dotenv from "dotenv";
dotenv.config();

import express from "express";
// import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import { connectToDatabase } from "../db/db.js";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// // Middleware
// app.use(cors({
//   origin: "https://your-frontend-url.onrender.com", // Replace with your actual frontend URL
//   credentials: true,
// }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// MongoDB session middleware
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: 'toll-notification-system',
      collectionName: 'sessions',
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse;

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

// Main server logic
(async () => {
  try {
    await connectToDatabase();
    const server = await registerRoutes(app);

    // Error handling
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);

      // Serve static files from React build
      app.use(express.static(path.join(__dirname, '../client/dist')));

      // Serve index.html for non-API routes
      app.get('*', (req, res, next) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(__dirname, '../client/dist/index.html'));
        } else {
          next();
        }
      });
    }

    const port = process.env.PORT || 5000;
    server.listen(port, '0.0.0.0', () => {
      log(`✅ Server is running on port ${port}`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
})();
