import { Schema, model, models, Types, type Model } from "mongoose";

export interface ProductDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;

  itemCode: string;
  itemName: string;
  description: string;

  category: string;
  brand: string;
  partNumber: string;

  uom: string;

  costPrice: number;
  sellingPrice: number;
  minSellingPrice: number;

  lowStockThreshold: number;

  imageUrl: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    itemCode: { type: String, required: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },

    category: { type: String, default: "", trim: true, index: true },
    brand: { type: String, default: "", trim: true },
    partNumber: { type: String, default: "", trim: true },

    uom: { type: String, default: "unit", trim: true },

    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    minSellingPrice: { type: Number, required: true, min: 0 },

    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },

    imageUrl: { type: String, default: "" },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Item codes are unique per organization, not globally. This compound index
// also lets prefix searches on itemCode use the index directly.
productSchema.index({ organizationId: 1, itemCode: 1 }, { unique: true });
productSchema.index({ organizationId: 1, itemName: 1 });
productSchema.index({ organizationId: 1, partNumber: 1 });

export const Product: Model<ProductDocument> =
  (models.Product as Model<ProductDocument>) || model<ProductDocument>("Product", productSchema);
