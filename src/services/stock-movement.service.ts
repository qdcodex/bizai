import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { InventoryItem } from "@/models/InventoryItem";
import {
  StockMovement,
  INBOUND_MOVEMENT_TYPES,
  type StockMovementType,
  type StockMovementReferenceType,
} from "@/models/StockMovement";
import { Product } from "@/models/Product";
import { AppError } from "@/lib/errors";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import type { StockMovementQueryInput } from "@/lib/validation/inventory";

export interface RecordMovementInput {
  organizationId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType?: StockMovementReferenceType;
  referenceId?: string | null;
  notes?: string;
  createdBy: string;
}

export interface MovementResult {
  movementId: string;
  previousStock: number;
  newStock: number;
}

/**
 * Applies a stock movement atomically: the InventoryItem's currentStock and
 * the audit StockMovement record are written inside one transaction, and
 * outbound movements use a conditional update (`currentStock >= quantity`)
 * so two concurrent decrements can never oversell — the second writer's
 * conditional update simply fails to match once the first has applied,
 * because MongoDB serializes writes to the same document.
 */
export async function recordStockMovement(input: RecordMovementInput): Promise<MovementResult> {
  await connectToDatabase();

  const isInbound = INBOUND_MOVEMENT_TYPES.includes(input.type);
  const organizationId = new Types.ObjectId(input.organizationId);
  const productId = new Types.ObjectId(input.productId);

  const product = await Product.findOne({ _id: productId, organizationId });
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }
  if (input.quantity <= 0) {
    throw new AppError("INVALID_STOCK_OPERATION", "Quantity must be greater than zero.", 400);
  }

  const session = await mongoose.startSession();
  try {
    let result: MovementResult | undefined;

    await session.withTransaction(async () => {
      let updatedItem;

      if (isInbound) {
        updatedItem = await InventoryItem.findOneAndUpdate(
          { organizationId, productId },
          { $inc: { currentStock: input.quantity } },
          { new: true, upsert: true, session },
        );
      } else {
        updatedItem = await InventoryItem.findOneAndUpdate(
          { organizationId, productId, currentStock: { $gte: input.quantity } },
          { $inc: { currentStock: -input.quantity } },
          { new: true, session },
        );
        if (!updatedItem) {
          const existing = await InventoryItem.findOne({ organizationId, productId }, null, {
            session,
          });
          throw new AppError(
            "INSUFFICIENT_STOCK",
            `Insufficient stock for ${product.itemName}: available ${existing?.currentStock ?? 0}, requested ${input.quantity}.`,
            409,
          );
        }
      }

      const newStock = updatedItem.currentStock;
      const previousStock = isInbound ? newStock - input.quantity : newStock + input.quantity;

      const [movement] = await StockMovement.create(
        [
          {
            organizationId,
            productId,
            type: input.type,
            quantity: input.quantity,
            previousStock,
            newStock,
            referenceType: input.referenceType ?? "MANUAL",
            referenceId: input.referenceId ? new Types.ObjectId(input.referenceId) : null,
            notes: input.notes ?? "",
            createdBy: new Types.ObjectId(input.createdBy),
          },
        ],
        { session },
      );

      result = { movementId: movement._id.toString(), previousStock, newStock };
    });

    if (!result) throw new AppError("INTERNAL_ERROR", "Failed to record stock movement.", 500);
    return result;
  } finally {
    await session.endSession();
  }
}

export interface StockMovementRow {
  id: string;
  productId: string;
  itemCode: string;
  itemName: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType: StockMovementReferenceType;
  notes: string;
  createdByName: string;
  createdAt: string;
}

export async function listStockMovements(
  organizationId: string,
  query: StockMovementQueryInput,
): Promise<PaginatedResult<StockMovementRow>> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { organizationId };
  if (query.productId) filter.productId = query.productId;
  if (query.type) filter.type = query.type;
  if (query.referenceType) filter.referenceType = query.referenceType;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  const skip = (query.page - 1) * query.limit;

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate<{ productId: { _id: Types.ObjectId; itemCode: string; itemName: string } }>(
        "productId",
        "itemCode itemName",
      )
      .populate<{ createdBy: { name: string } }>("createdBy", "name"),
    StockMovement.countDocuments(filter),
  ]);

  const data: StockMovementRow[] = movements
    .filter((m) => m.productId)
    .map((m) => ({
      id: m._id.toString(),
      productId: String(m.productId._id),
      itemCode: m.productId.itemCode,
      itemName: m.productId.itemName,
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      referenceType: m.referenceType,
      notes: m.notes,
      createdByName: m.createdBy?.name ?? "Unknown",
      createdAt: m.createdAt.toISOString(),
    }));

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}
