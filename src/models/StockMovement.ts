import { Schema, model, models, Types, type Model } from "mongoose";

export const STOCK_MOVEMENT_TYPES = [
  "PURCHASE",
  "SALE",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** Movement types that increase stock; all others decrease it. */
export const INBOUND_MOVEMENT_TYPES: readonly StockMovementType[] = [
  "PURCHASE",
  "ADJUSTMENT_IN",
  "RETURN_IN",
  "TRANSFER_IN",
];

export const STOCK_MOVEMENT_REFERENCE_TYPES = [
  "MANUAL",
  "QUOTATION",
  "PURCHASE_ORDER",
  "OTHER",
] as const;
export type StockMovementReferenceType = (typeof STOCK_MOVEMENT_REFERENCE_TYPES)[number];

export interface StockMovementDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  productId: Types.ObjectId;

  type: StockMovementType;
  quantity: number;

  previousStock: number;
  newStock: number;

  referenceType: StockMovementReferenceType;
  referenceId: Types.ObjectId | null;

  notes: string;

  createdBy: Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<StockMovementDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },

    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true, min: 1 },

    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },

    referenceType: {
      type: String,
      enum: STOCK_MOVEMENT_REFERENCE_TYPES,
      default: "MANUAL",
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },

    notes: { type: String, default: "", trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ organizationId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ organizationId: 1, createdAt: -1 });

export const StockMovement: Model<StockMovementDocument> =
  (models.StockMovement as Model<StockMovementDocument>) ||
  model<StockMovementDocument>("StockMovement", stockMovementSchema);
