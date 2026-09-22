import { Schema, model, models, Types, type Model } from "mongoose";

export interface UserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  activeOrganizationId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    activeOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
  },
  { timestamps: true },
);

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", userSchema);
