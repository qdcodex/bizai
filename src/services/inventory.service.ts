import { Types, type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type ProductDocument } from "@/models/Product";
import { InventoryItem } from "@/models/InventoryItem";
import { StockMovement } from "@/models/StockMovement";
import { AppError } from "@/lib/errors";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import type { InventoryQueryInput } from "@/lib/validation/inventory";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function deriveStockStatus(currentStock: number, lowStockThreshold: number): StockStatus {
  if (currentStock <= 0) return "OUT_OF_STOCK";
  if (currentStock <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

/**
 * Aggregation stages that join a product with its InventoryItem and derive
 * `currentStock` / `stockStatus`. Shared by ProductService (for the stock
 * status filter on the product list) and InventoryService itself, so the
 * status logic is defined exactly once.
 */
export function stockJoinStages(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: InventoryItem.collection.name,
        localField: "_id",
        foreignField: "productId",
        as: "_inventory",
      },
    },
    { $unwind: { path: "$_inventory", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        currentStock: { $ifNull: ["$_inventory.currentStock", 0] },
        stockStatus: {
          $switch: {
            branches: [
              { case: { $lte: [{ $ifNull: ["$_inventory.currentStock", 0] }, 0] }, then: "OUT_OF_STOCK" },
              {
                case: {
                  $lte: [{ $ifNull: ["$_inventory.currentStock", 0] }, "$lowStockThreshold"],
                },
                then: "LOW_STOCK",
              },
            ],
            default: "IN_STOCK",
          },
        },
      },
    },
    { $project: { _inventory: 0 } },
  ];
}

/** Ensures a product has an InventoryItem row (created at zero stock on product creation). */
export async function ensureInventoryItem(
  organizationId: string,
  productId: string,
): Promise<void> {
  await connectToDatabase();
  await InventoryItem.findOneAndUpdate(
    { organizationId, productId },
    { $setOnInsert: { currentStock: 0 } },
    { upsert: true },
  );
}

export interface InventoryListRow {
  productId: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  costPrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
  currentStock: number;
  stockStatus: StockStatus;
  lastMovementAt: string | null;
}

export async function listInventory(
  organizationId: string,
  query: InventoryQueryInput,
): Promise<PaginatedResult<InventoryListRow>> {
  await connectToDatabase();

  const match: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
    isActive: true,
  };
  if (query.category) match.category = query.category;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), "i");
    match.$or = [{ itemName: regex }, { itemCode: regex }, { partNumber: regex }];
  }

  const skip = (query.page - 1) * query.limit;

  const pipeline: PipelineStage[] = [
    { $match: match },
    ...stockJoinStages(),
    ...(query.stockStatus !== "all" ? [{ $match: { stockStatus: query.stockStatus } } as PipelineStage] : []),
    {
      $facet: {
        data: [
          { $sort: { itemName: 1 } },
          { $skip: skip },
          { $limit: query.limit },
          {
            $lookup: {
              from: StockMovement.collection.name,
              let: { productId: "$_id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$productId", "$$productId"] } } },
                { $sort: { createdAt: -1 } },
                { $limit: 1 },
                { $project: { createdAt: 1 } },
              ],
              as: "_lastMovement",
            },
          },
          {
            $project: {
              itemCode: 1,
              itemName: 1,
              category: 1,
              uom: 1,
              costPrice: 1,
              sellingPrice: 1,
              lowStockThreshold: 1,
              currentStock: 1,
              stockStatus: 1,
              lastMovementAt: { $arrayElemAt: ["$_lastMovement.createdAt", 0] },
            },
          },
        ],
        totalCount: [{ $count: "total" }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  const rows = (result?.data ?? []) as Array<
    Omit<InventoryListRow, "productId" | "lastMovementAt"> & { _id: unknown; lastMovementAt: Date | null }
  >;
  const total = result?.totalCount?.[0]?.total ?? 0;

  const data: InventoryListRow[] = rows.map((row) => ({
    productId: String((row as unknown as { _id: unknown })._id),
    itemCode: row.itemCode,
    itemName: row.itemName,
    category: row.category,
    uom: row.uom,
    costPrice: row.costPrice,
    sellingPrice: row.sellingPrice,
    lowStockThreshold: row.lowStockThreshold,
    currentStock: row.currentStock,
    stockStatus: row.stockStatus,
    lastMovementAt: row.lastMovementAt ? new Date(row.lastMovementAt).toISOString() : null,
  }));

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export interface InventoryDetail {
  product: ProductDocument;
  currentStock: number;
  stockStatus: StockStatus;
  recentMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    notes: string;
    createdAt: string;
  }>;
}

export async function getInventoryDetail(
  organizationId: string,
  productId: string,
): Promise<InventoryDetail> {
  await connectToDatabase();

  const product = await Product.findOne({ _id: productId, organizationId });
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }

  const inventoryItem = await InventoryItem.findOne({ organizationId, productId });
  const currentStock = inventoryItem?.currentStock ?? 0;
  const stockStatus = deriveStockStatus(currentStock, product.lowStockThreshold);

  const movements = await StockMovement.find({ organizationId, productId })
    .sort({ createdAt: -1 })
    .limit(20);

  return {
    product,
    currentStock,
    stockStatus,
    recentMovements: movements.map((m) => ({
      id: m._id.toString(),
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export interface LowStockProduct {
  productId: string;
  itemCode: string;
  itemName: string;
  currentStock: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
}

/** AI-ready: used by the dashboard today, and will back the `getLowStockProducts` tool in Phase 3. */
export async function getLowStockProducts(
  organizationId: string,
  limit = 50,
): Promise<LowStockProduct[]> {
  await connectToDatabase();

  const pipeline: PipelineStage[] = [
    { $match: { organizationId: new Types.ObjectId(organizationId), isActive: true } },
    ...stockJoinStages(),
    { $match: { stockStatus: { $in: ["LOW_STOCK", "OUT_OF_STOCK"] } } },
    { $sort: { currentStock: 1 } },
    { $limit: limit },
    { $project: { itemCode: 1, itemName: 1, currentStock: 1, lowStockThreshold: 1, stockStatus: 1 } },
  ];

  const rows = await Product.aggregate(pipeline);
  return rows.map((row) => ({
    productId: String(row._id),
    itemCode: row.itemCode,
    itemName: row.itemName,
    currentStock: row.currentStock,
    lowStockThreshold: row.lowStockThreshold,
    stockStatus: row.stockStatus,
  }));
}

/** AI-ready: used by quotation creation today, and will back the `checkStockAvailability` tool in Phase 3. */
export async function checkStockAvailability(
  organizationId: string,
  productId: string,
  quantity: number,
): Promise<{ available: boolean; currentStock: number }> {
  await connectToDatabase();
  const item = await InventoryItem.findOne({ organizationId, productId });
  const currentStock = item?.currentStock ?? 0;
  return { available: currentStock >= quantity, currentStock };
}

export interface StockAdjustmentPreview {
  product: { id: string; itemCode: string; itemName: string; uom: string };
  direction: "IN" | "OUT";
  quantity: number;
  currentStock: number;
  newStock: number;
  notes: string;
}

/**
 * Computes what a stock adjustment WOULD do — current stock, resulting
 * stock, and (for outbound adjustments) whether there's enough stock to
 * remove — without writing anything. Mirrors previewQuotation in
 * quotation.service.ts: used by the AI assistant's `adjustStock` tool to
 * build a confirmable preview before any write occurs.
 */
export async function previewStockAdjustment(
  organizationId: string,
  input: { productId: string; direction: "IN" | "OUT"; quantity: number; notes?: string },
): Promise<StockAdjustmentPreview> {
  await connectToDatabase();

  const product = await Product.findOne({ _id: input.productId, organizationId, isActive: true });
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }

  const item = await InventoryItem.findOne({ organizationId, productId: input.productId });
  const currentStock = item?.currentStock ?? 0;
  const newStock = input.direction === "IN" ? currentStock + input.quantity : currentStock - input.quantity;

  if (input.direction === "OUT" && newStock < 0) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      `Cannot remove ${input.quantity} units of ${product.itemName} — only ${currentStock} in stock.`,
      409,
    );
  }

  return {
    product: { id: product._id.toString(), itemCode: product.itemCode, itemName: product.itemName, uom: product.uom },
    direction: input.direction,
    quantity: input.quantity,
    currentStock,
    newStock,
    notes: input.notes ?? "",
  };
}

export interface InventorySummary {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export async function getInventorySummary(organizationId: string): Promise<InventorySummary> {
  await connectToDatabase();

  const pipeline: PipelineStage[] = [
    { $match: { organizationId: new Types.ObjectId(organizationId), isActive: true } },
    ...stockJoinStages(),
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        lowStockCount: { $sum: { $cond: [{ $eq: ["$stockStatus", "LOW_STOCK"] }, 1, 0] } },
        outOfStockCount: { $sum: { $cond: [{ $eq: ["$stockStatus", "OUT_OF_STOCK"] }, 1, 0] } },
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  return {
    totalProducts: result?.totalProducts ?? 0,
    lowStockCount: result?.lowStockCount ?? 0,
    outOfStockCount: result?.outOfStockCount ?? 0,
  };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
