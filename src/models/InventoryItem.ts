import { Schema, model, models, Types, type Model } from "mongoose";

/**
 * Tracks current stock for a product. Deliberately minimal — pricing and the
 * low-stock threshold live on Product so they aren't duplicated; IN_STOCK /
 * LOW_STOCK / OUT_OF_STOCK is always derived at read time, never stored.
 */
export interface InventoryItemDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  productId: Types.ObjectId;
  currentStock: number;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<InventoryItemDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    currentStock: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

inventoryItemSchema.index({ organizationId: 1, productId: 1 }, { unique: true });

export const InventoryItem: Model<InventoryItemDocument> =
  (models.InventoryItem as Model<InventoryItemDocument>) ||
  model<InventoryItemDocument>("InventoryItem", inventoryItemSchema);
