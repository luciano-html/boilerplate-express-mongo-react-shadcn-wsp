import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  role: 'admin' | 'staff';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, select: false },
    role: { type: String, required: true, enum: ['admin', 'staff'], default: 'staff' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
