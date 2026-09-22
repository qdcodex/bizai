import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { AIUsage } from "@/models/AIUsage";
import { estimateCostUsd } from "@/ai/models/config";
import { estimateEmbeddingCostUsd } from "@/ai/rag/config";

export interface RecordUsageInput {
  organizationId: string;
  userId: string;
  conversationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  toolStepCount?: number;
  ragRetrievalCount?: number;
}

export async function recordAIUsage(input: RecordUsageInput): Promise<void> {
  await connectToDatabase();

  const totalTokens = input.inputTokens + input.outputTokens;
  await AIUsage.create({
    organizationId: input.organizationId,
    userId: input.userId,
    conversationId: input.conversationId,
    kind: "chat",
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(input.model, input.inputTokens, input.outputTokens),
    durationMs: input.durationMs,
    toolStepCount: input.toolStepCount ?? null,
    ragRetrievalCount: input.ragRetrievalCount ?? null,
  });
}

export interface RecordEmbeddingUsageInput {
  organizationId: string;
  userId: string;
  documentId: string;
  model: string;
  tokens: number;
  durationMs: number;
}

/** Tracked separately from chat usage — generated during document ingestion, not per question. */
export async function recordEmbeddingUsage(input: RecordEmbeddingUsageInput): Promise<void> {
  await connectToDatabase();

  await AIUsage.create({
    organizationId: input.organizationId,
    userId: input.userId,
    documentId: input.documentId,
    kind: "embedding",
    model: input.model,
    inputTokens: input.tokens,
    outputTokens: 0,
    totalTokens: input.tokens,
    estimatedCostUsd: estimateEmbeddingCostUsd(input.model, input.tokens),
    durationMs: input.durationMs,
  });
}

export interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface UsageByDay {
  date: string;
  requests: number;
  totalTokens: number;
}

export interface UsageByUser {
  userId: string;
  userName: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageByModel {
  model: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface OrganizationUsageReport {
  summary: UsageSummary;
  byDay: UsageByDay[];
  byUser: UsageByUser[];
  byModel: UsageByModel[];
  embeddingSummary: UsageSummary;
}

/** Powers /admin/ai-usage. All figures are scoped to one organization. Chat and embedding usage are reported separately. */
export async function getOrganizationUsageReport(
  organizationId: string,
  days = 30,
): Promise<OrganizationUsageReport> {
  await connectToDatabase();

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const orgObjectId = new Types.ObjectId(organizationId);
  const chatMatch = { organizationId: orgObjectId, kind: "chat", createdAt: { $gte: since } };

  const [summaryResult, byDayResult, byUserResult, byModelResult, embeddingSummaryResult] = await Promise.all([
    AIUsage.aggregate([
      { $match: chatMatch },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: "$totalTokens" },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          estimatedCostUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } },
        },
      },
    ]),
    AIUsage.aggregate([
      { $match: chatMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          requests: { $sum: 1 },
          totalTokens: { $sum: "$totalTokens" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AIUsage.aggregate([
      { $match: chatMatch },
      {
        $group: {
          _id: "$userId",
          requests: { $sum: 1 },
          totalTokens: { $sum: "$totalTokens" },
          estimatedCostUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
    ]),
    AIUsage.aggregate([
      { $match: chatMatch },
      {
        $group: {
          _id: "$model",
          requests: { $sum: 1 },
          totalTokens: { $sum: "$totalTokens" },
          estimatedCostUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } },
        },
      },
      { $sort: { requests: -1 } },
    ]),
    AIUsage.aggregate([
      { $match: { organizationId: orgObjectId, kind: "embedding", createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: "$totalTokens" },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          estimatedCostUsd: { $sum: { $ifNull: ["$estimatedCostUsd", 0] } },
        },
      },
    ]),
  ]);

  const toSummary = (row: (typeof summaryResult)[number] | undefined): UsageSummary =>
    row
      ? {
          totalRequests: row.totalRequests,
          totalTokens: row.totalTokens,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          estimatedCostUsd: row.estimatedCostUsd,
        }
      : { totalRequests: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

  const byDay: UsageByDay[] = byDayResult.map((row) => ({
    date: row._id,
    requests: row.requests,
    totalTokens: row.totalTokens,
  }));

  const byUser: UsageByUser[] = byUserResult.map((row) => ({
    userId: String(row._id),
    userName: row.user?.[0]?.name ?? "Unknown user",
    requests: row.requests,
    totalTokens: row.totalTokens,
    estimatedCostUsd: row.estimatedCostUsd,
  }));

  const byModel: UsageByModel[] = byModelResult.map((row) => ({
    model: row._id,
    requests: row.requests,
    totalTokens: row.totalTokens,
    estimatedCostUsd: row.estimatedCostUsd,
  }));

  return {
    summary: toSummary(summaryResult[0]),
    byDay,
    byUser,
    byModel,
    embeddingSummary: toSummary(embeddingSummaryResult[0]),
  };
}
