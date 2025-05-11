import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
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

// ================== Middleware Setup ==================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS Configuration
app.use(cors({
  origin: true, // Allow same-origin requests
  credentials: true // Required for session cookies
}));

// Session Configuration
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
      secure: true, // REQUIRED for Render's HTTPS
      sameSite: 'none', // Essential for cross-origin cookies
      maxAge: 30 * 24 * 60 * 60 * 1000,
    }
  })
);

// ================== Request Logging ==================
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  let responseBody;

  const originalJson = res.json;
  res.json = function(body) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith('/api')) {
      let logMessage = `${req.method} ${requestPath} ${res.statusCode} [${duration}ms]`;
      if (responseBody) {
        logMessage += ` :: ${JSON.stringify(responseBody).slice(0, 100)}`;
      }
      log(logMessage);
    }
  });

  next();
});

// ================== Server Initialization ==================
(async () => {
  try {
    // Database Connection
    await connectToDatabase();
    log('✅ MongoDB connection established');

    // Route Registration
    const server = await registerRoutes(app);
    
    // Error Handling (Must be after routes)
    app.use((err, req, res, next) => {
      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';
      res.status(status).json({ error: message });
    });

    // Static File Serving (LAST MIDDLEWARE)
    if (process.env.NODE_ENV === 'production') {
      // Serve static files from React build
      app.use(express.static(path.join(__dirname, '../client/dist')));
      
      // Handle SPA routing for non-API requests
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(__dirname, '../client/dist/index.html'));
        }
      });
    }

    // Server Start
    const port = process.env.PORT || 5000;
    server.listen(port, '0.0.0.0', () => {
      log(`🚀 Server running on port ${port}`);
      log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    log(`❌ Critical startup failure: ${error.message}`);
    process.exit(1);
  }
})();