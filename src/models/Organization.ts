import { Schema, model, models, Types, type Model } from "mongoose";

export interface OrganizationDocument {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  settings: {
    currency: string;
    timezone: string;
    /** Quotations with a grand total above this amount require approval before conversion. */
    quotationApprovalThreshold: number;
    /** Whether admins/owners may override the minimum-selling-price rule on a quotation line. */
    allowMinPriceOverride: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    settings: {
      currency: { type: String, default: "INR" },
      timezone: { type: String, default: "Asia/Kolkata" },
      quotationApprovalThreshold: { type: Number, default: 1000 },
      allowMinPriceOverride: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export const Organization: Model<OrganizationDocument> =
  (models.Organization as Model<OrganizationDocument>) ||
  model<OrganizationDocument>("Organization", organizationSchema);
