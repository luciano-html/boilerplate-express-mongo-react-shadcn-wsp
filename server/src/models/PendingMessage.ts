import mongoose, { Schema, Document } from 'mongoose';

export interface IPendingMessage extends Document {
  to: string;
  body: string;
  sendAfter: Date;
  orderId?: mongoose.Types.ObjectId;
  /** Si esta seteado, el mensaje solo sale si la orden sigue en uno de estos estados. */
  onlyIfStatusIn?: string[];
  sentAt?: Date;
  attempts: number;
  lastError?: string;
}

const pendingMessageSchema = new Schema<IPendingMessage>(
  {
    to: { type: String, required: true },
    body: { type: String, required: true },
    sendAfter: { type: Date, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    onlyIfStatusIn: [{ type: String }],
    sentAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true }
);

pendingMessageSchema.index({ sentAt: 1, sendAfter: 1 });

export const PendingMessage = mongoose.model<IPendingMessage>('PendingMessage', pendingMessageSchema);
