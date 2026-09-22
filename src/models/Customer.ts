import { Schema, model, models, Types, type Model } from "mongoose";

export interface CustomerDocument {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;

  customerCode: string;
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

  creditLimit: number;
  paymentTerms: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    customerCode: { type: String, required: true, trim: true },
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

    creditLimit: { type: Number, default: 0, min: 0 },
    paymentTerms: { type: String, default: "Net 30", trim: true },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

customerSchema.index({ organizationId: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ organizationId: 1, name: 1 });
customerSchema.index({ organizationId: 1, email: 1 });

export const Customer: Model<CustomerDocument> =
  (models.Customer as Model<CustomerDocument>) ||
  model<CustomerDocument>("Customer", customerSchema);
