import mongoose, { Schema, Document } from 'mongoose';
import { Product as ISharedProduct, ProductOptionGroup } from 'shared/index';

export interface IProduct extends Omit<ISharedProduct, 'id'>, Document {}

const productOptionSchema = new Schema({
  name: { type: String, required: true },
  additionalPrice: { type: Number, default: 0 },
});

const productOptionGroupSchema = new Schema({
  name: { type: String, required: true },
  minSelect: { type: Number, required: true, default: 0 },
  maxSelect: { type: Number, required: true, default: 1 },
  options: [productOptionSchema],
});

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    category: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    images: [{ type: String }],
    optionGroups: [productOptionGroupSchema],
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', productSchema);
