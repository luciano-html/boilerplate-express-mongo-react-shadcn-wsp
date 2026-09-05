import mongoose, { Schema, Document } from 'mongoose';
import { StoreConfig as ISharedStoreConfig, DeliveryZone } from 'shared/index';

export interface IStoreConfig extends Omit<ISharedStoreConfig, 'id'>, Document {}

const deliveryZoneSchema = new Schema({
  city: { type: String, enum: ['Santo Tomé', 'Santa Fe'], required: true },
  neighborhood: { type: String, required: true },
  cost: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
});

const storeConfigSchema = new Schema<IStoreConfig>(
  {
    name: { type: String, required: true },
    whatsapp: { type: String, required: true },
    currency: { type: String, required: true, default: 'USD' },
    logoUrl: { type: String },
    deliveryZones: [deliveryZoneSchema],
    basePrepTime: { type: Number, required: true, default: 15 },
    delayPerPendingOrder: { type: Number, required: true, default: 8 },
    deliveryTimePerOrderInQueue: { type: Number, required: true, default: 3 },
    baseCourierTravelTime: { type: Number, required: true, default: 10 },
    socials: {
      instagram: { type: String },
      facebook: { type: String },
      twitter: { type: String },
    },
    businessHours: { type: String },
  },
  { timestamps: true }
);

export const StoreConfig = mongoose.model<IStoreConfig>('StoreConfig', storeConfigSchema);
