import mongoose, { Schema, Document } from 'mongoose';
import { Order as ISharedOrder, OrderItem, SelectedOption } from 'shared/index';

export interface IOrder extends Omit<ISharedOrder, 'id' | '_id' | 'items'>, Document {
  items: (Omit<OrderItem, 'productId'> & { productId: mongoose.Types.ObjectId })[];
  /** Handshake (Fase 4): JID verificado del cliente. */
  customerJid?: string;
  confirmedAt?: Date;
}

const selectedOptionSchema = new Schema({
  groupName: { type: String, required: true },
  optionName: { type: String, required: true },
  additionalPrice: { type: Number, default: 0 },
});

const statusEventSchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const orderItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String },
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
    // Zona de StoreConfig.deliveryZones. Define el costo de envio.
    deliveryNeighborhood: { type: String },
    // Calle y numero, texto libre. Es a donde va el cadete.
    deliveryAddress: { type: String },
    paymentMethod: { type: String, enum: ['cash', 'transfer'], required: true },
    discounts: { type: Number, default: 0 },
    surcharges: { type: Number, default: 0 },
    orderNumber: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'cooking', 'ready', 'on_the_way', 'closed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'confirmed'],
      default: 'pending',
    },
    statusHistory: { type: [statusEventSchema], default: [] },
    /** Handshake web -> WhatsApp. JID real desde el que escribio. */
    handshakeCode: { type: String, index: true },
    customerJid: { type: String },
    confirmedAt: { type: Date },
    estimatedTime: { type: Number },
    // Ultimo aviso que no se pudo entregar. Un .catch que loguea y sigue deja
    // al local creyendo que el cliente fue avisado; esto lo hace visible.
    lastNotificationError: {
      at: { type: Date },
      message: { type: String },
    },
  },
  { timestamps: true }
);

// El ETA consulta por estado + fecha en cada pedido nuevo, y los reportes de la
// Fase 5 van a filtrar por fecha. Este indice cubre las dos.
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
