import mongoose, { Schema, Document } from 'mongoose';
import { StoreConfig as ISharedStoreConfig, DeliveryZone } from 'shared/index';

export interface IStoreConfig extends Omit<ISharedStoreConfig, 'id' | '_id'>, Document {}

const deliveryZoneSchema = new Schema({
  city: { type: String, enum: ['Santo Tomé', 'Santa Fe'], required: true },
  neighborhood: { type: String, required: true },
  cost: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
});

const navContentBlockSchema = new Schema(
  {
    type: { type: String, enum: ['heading', 'text', 'image'], required: true },
    value: { type: String, default: '' },
  },
  { _id: false }
);

// El slug es el identificador estable del item de nav. Product.categorySlug lo referencia.
const navSectionSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['category', 'page'], required: true, default: 'category' },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
    content: { blocks: { type: [navContentBlockSchema], default: undefined } },
  },
  { _id: false }
);

const storeConfigSchema = new Schema<IStoreConfig>(
  {
    name: { type: String, required: true },
    whatsapp: { type: String, required: true },
    currency: { type: String, required: true, default: 'USD' },
    logoUrl: { type: String },
    deliveryZones: [deliveryZoneSchema],
    navSections: { type: [navSectionSchema], default: [] },
    basePrepTime: { type: Number, required: true, default: 15 },
    delayPerPendingOrder: { type: Number, required: true, default: 8 },
    deliveryTimePerOrderInQueue: { type: Number, default: 5 },
    baseCourierTravelTime: { type: Number, default: 15 },
    isBotActive: { type: Boolean, default: false },
    socials: {
      instagram: { type: String },
      facebook: { type: String },
      twitter: { type: String },
    },
    businessHours: { type: String },
    transferAlias: { type: String },
  },
  { timestamps: true }
);

export const StoreConfig = mongoose.model<IStoreConfig>('StoreConfig', storeConfigSchema);
