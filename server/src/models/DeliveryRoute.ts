import mongoose, { Schema, Document } from 'mongoose';

export type DeliveryRouteStatus = 'open' | 'dispatched' | 'closed';

export interface IDeliveryRoute extends Document {
  routeNumber: number;
  courierName: string;
  status: DeliveryRouteStatus;
  /** Pedidos en el orden en que el cadete los va a entregar. */
  stops: mongoose.Types.ObjectId[];
  dispatchedAt?: Date;
  closedAt?: Date;
}

const deliveryRouteSchema = new Schema<IDeliveryRoute>(
  {
    routeNumber: { type: Number, required: true, index: true },
    courierName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['open', 'dispatched', 'closed'],
      default: 'open',
      index: true,
    },
    // El orden del array ES el orden de las paradas. No hace falta un campo
    // `sequence`: reordenar es mover el elemento, y no hay dos fuentes de
    // verdad que se puedan contradecir.
    stops: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    dispatchedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

export const DeliveryRoute = mongoose.model<IDeliveryRoute>('DeliveryRoute', deliveryRouteSchema);
