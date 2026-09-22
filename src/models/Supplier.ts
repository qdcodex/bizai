import { Schema, model, models, Types, type Model } from "mongoose";

export interface SupplierDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;

  supplierCode: string;
  name: string;
  companyName: string;

  email: string;
  phone: string;
  taxNumber: string;

  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;

  paymentTerms: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<SupplierDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    supplierCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, default: "", trim: true },

    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    taxNumber: { type: String, default: "", trim: true },

    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    postalCode: { type: String, default: "", trim: true },

    paymentTerms: { type: String, default: "Net 30", trim: true },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

supplierSchema.index({ organizationId: 1, supplierCode: 1 }, { unique: true });
supplierSchema.index({ organizationId: 1, name: 1 });
supplierSchema.index({ organizationId: 1, email: 1 });

export const Supplier: Model<SupplierDocument> =
  (models.Supplier as Model<SupplierDocument>) ||
  model<SupplierDocument>("Supplier", supplierSchema);
