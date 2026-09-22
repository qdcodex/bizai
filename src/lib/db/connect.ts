import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __bizaiMongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.__bizaiMongooseCache ?? {
  conn: null,
  promise: null,
};
global.__bizaiMongooseCache = cache;

/** Returns a shared, memoized Mongoose connection (safe to call from any server-side code). */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const { MONGODB_URI } = getEnv();
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
