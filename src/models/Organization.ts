import { Schema, model, models, Types, type Model } from "mongoose";
import type { Role } from "@/models/roles";

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
    /**
     * Which optional modules each role can see/use, keyed by role. A role
     * missing from this map defaults to "all modules visible" (backward
     * compatible with orgs that never configured this). `owner` is never
     * looked up — the owner role always has full access regardless of this
     * setting. See src/lib/auth/modules.ts for the module key registry and
     * the actual enforcement (requirePagePermission), not just sidebar UI.
     */
    moduleVisibility: Partial<Record<Role, string[]>>;
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
      moduleVisibility: { type: Schema.Types.Mixed, default: {} },
    },
  },
  { timestamps: true },
);

export const Organization: Model<OrganizationDocument> =
  (models.Organization as Model<OrganizationDocument>) ||
  model<OrganizationDocument>("Organization", organizationSchema);
