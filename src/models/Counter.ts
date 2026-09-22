import { Schema, model, models, type Model } from "mongoose";

export interface CounterDocument {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter: Model<CounterDocument> =
  (models.Counter as Model<CounterDocument>) || model<CounterDocument>("Counter", counterSchema);

/**
 * Atomically increments and returns the next sequence number for `key`.
 * Safe under concurrent calls — MongoDB's findOneAndUpdate with $inc is atomic.
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return doc!.seq;
}
