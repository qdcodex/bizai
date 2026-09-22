import { Schema, model, models, Types, type Model } from "mongoose";

export const QUOTATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
  "CANCELLED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface QuotationItem {
  productId: Types.ObjectId;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface QuotationDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;

  quotationNumber: string;

  customerId: Types.ObjectId;

  items: QuotationItem[];

  subtotal: number;
  discount: number;
  tax: number;
  total: number;

  status: QuotationStatus;

  validUntil: Date | null;
  notes: string;

  createdBy: Types.ObjectId;
  approvedBy: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const quotationItemSchema = new Schema<QuotationItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    uom: { type: String, default: "unit" },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const quotationSchema = new Schema<QuotationDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    quotationNumber: { type: String, required: true, trim: true },

    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },

    items: { type: [quotationItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },

    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },

    status: { type: String, enum: QUOTATION_STATUSES, required: true, default: "DRAFT" },

    validUntil: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

quotationSchema.index({ organizationId: 1, quotationNumber: 1 }, { unique: true });
quotationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
quotationSchema.index({ organizationId: 1, customerId: 1, createdAt: -1 });

export const Quotation: Model<QuotationDocument> =
  (models.Quotation as Model<QuotationDocument>) ||
  model<QuotationDocument>("Quotation", quotationSchema);
