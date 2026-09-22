import { Schema, model, models, Types, type Model } from "mongoose";
import { ROLES, type Role } from "@/models/roles";

export interface MembershipDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<MembershipDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    role: { type: String, enum: ROLES, required: true, default: "viewer" },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const Membership: Model<MembershipDocument> =
  (models.Membership as Model<MembershipDocument>) ||
  model<MembershipDocument>("Membership", membershipSchema);
