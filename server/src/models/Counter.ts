import mongoose, { Schema, Document } from 'mongoose';

// Document<string> porque el _id es el nombre de la secuencia, no un ObjectId.
interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);

/**
 * Secuencia atomica. findOneAndUpdate con $inc es una sola operacion en Mongo,
 * asi que dos pedidos simultaneos no pueden sacar el mismo numero (cosa que si
 * pasaria con un count() + 1).
 */
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc!.seq;
}
