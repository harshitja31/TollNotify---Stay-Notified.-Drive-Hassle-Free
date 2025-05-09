import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return mongoose.connection; // ✅ return connection if already connected
  }

  try {
    await mongoose.connect(uri, {
      dbName: "toll-notification-system",
      serverSelectionTimeoutMS: 5000,   // 5 seconds
      socketTimeoutMS: 45000,            // 45 seconds
    });

    isConnected = true;
    console.log("✅ MongoDB connected successfully");

    mongoose.connection.on("connected", () => {
      console.log("✅ Mongoose connected to DB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ Mongoose connection error:", err);
    });

    return mongoose.connection; // ✅ important: return the connection here
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}
