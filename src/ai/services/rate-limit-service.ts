import { connectToDatabase } from "@/lib/db/connect";
import { AIUsage } from "@/models/AIUsage";
import { PendingAction } from "@/models/PendingAction";
import { AI_WRITE_ACTION_RATE_LIMIT_PER_MINUTE } from "@/ai/config";
import { Types } from "mongoose";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Simple per-organization sliding-window rate limiter backed by the AIUsage
 * collection that already exists for tracking — no new infrastructure
 * (Redis, etc.) needed for this scale. The interface is intentionally small
 * so a Redis- or gateway-backed implementation can replace it later without
 * touching call sites.
 */
export interface RateLimiter {
  check(organizationId: string): Promise<RateLimitResult>;
}

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT_PER_MINUTE = 20;

class MongoWindowRateLimiter implements RateLimiter {
  constructor(private readonly limitPerMinute = DEFAULT_LIMIT_PER_MINUTE) {}

  async check(organizationId: string): Promise<RateLimitResult> {
    await connectToDatabase();

    const windowStart = new Date(Date.now() - WINDOW_MS);
    const count = await AIUsage.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      createdAt: { $gte: windowStart },
    });

    const allowed = count < this.limitPerMinute;
    return {
      allowed,
      limit: this.limitPerMinute,
      remaining: Math.max(0, this.limitPerMinute - count),
      retryAfterSeconds: allowed ? undefined : 60,
    };
  }
}

export const rateLimiter: RateLimiter = new MongoWindowRateLimiter(
  Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || DEFAULT_LIMIT_PER_MINUTE,
);

/**
 * Separate, tighter limit for confirming write actions (POST .../confirm) —
 * distinct from the normal chat-request limiter above, per Phase 5's
 * requirement to bound AI-driven write volume independently of read/RAG
 * chat traffic. Counts pending actions created per organization, since a
 * write action always starts life as one before it can be confirmed.
 */
class WriteActionRateLimiter implements RateLimiter {
  constructor(private readonly limitPerMinute = AI_WRITE_ACTION_RATE_LIMIT_PER_MINUTE) {}

  async check(organizationId: string): Promise<RateLimitResult> {
    await connectToDatabase();

    const windowStart = new Date(Date.now() - WINDOW_MS);
    const count = await PendingAction.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      createdAt: { $gte: windowStart },
    });

    const allowed = count < this.limitPerMinute;
    return {
      allowed,
      limit: this.limitPerMinute,
      remaining: Math.max(0, this.limitPerMinute - count),
      retryAfterSeconds: allowed ? undefined : 60,
    };
  }
}

export const writeActionRateLimiter: RateLimiter = new WriteActionRateLimiter();
