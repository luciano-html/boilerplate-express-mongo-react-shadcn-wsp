import mongoose, { Schema, Document } from 'mongoose';
import { Order as ISharedOrder, OrderItem, SelectedOption } from 'shared/index';

export interface IOrder extends Omit<ISharedOrder, 'id' | '_id' | 'items'>, Document {
  items: (Omit<OrderItem, 'productId'> & { productId: mongoose.Types.ObjectId })[];
}

const selectedOptionSchema = new Schema({
  groupName: { type: String, required: true },
  optionName: { type: String, required: true },
  additionalPrice: { type: Number, default: 0 },
});

const orderItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  selectedOptions: [selectedOptionSchema],
  notes: { type: String },
});

const orderSchema = new Schema<IOrder>(
  {
    items: [orderItemSchema],
    total: { type: Number, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    orderType: { type: String, enum: ['delivery', 'takeaway'], required: true },
    deliveryCity: { type: String, enum: ['Santo Tomé', 'Santa Fe'] },
    deliveryNeighborhood: { type: String },
    paymentMethod: { type: String, enum: ['cash', 'transfer'], required: true },
    discounts: { type: Number, default: 0 },
    surcharges: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending_payment', 'pending', 'in_preparation', 'in_expedition', 'dispatched', 'delivered', 'cancelled'],
      default: 'pending',
    },
    estimatedTime: { type: Number },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
