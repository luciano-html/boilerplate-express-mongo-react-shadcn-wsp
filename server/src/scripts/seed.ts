import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { StoreConfig } from '../models/StoreConfig';
import { Product } from '../models/Product';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27018/b2b2c-boilerplate');
    console.log('MongoDB Connected');

    await User.deleteMany({});
    await StoreConfig.deleteMany({});
    await Product.deleteMany({});

    // Seed Config
    await StoreConfig.create({
      name: 'Real Burger',
      whatsapp: '3421234567',
      currency: 'ARS',
      businessHours: 'Lunes a Domingo de 19 a 23hs',
      deliveryZones: [
        { city: 'Santo Tomé', neighborhood: 'Centro', cost: 1500, isActive: true },
        { city: 'Santa Fe', neighborhood: 'Sur', cost: 3000, isActive: true },
      ],
      basePrepTime: 15,
      delayPerPendingOrder: 8,
      deliveryTimePerOrderInQueue: 3,
      baseCourierTravelTime: 10
    });
    console.log('StoreConfig seeded');

    // Seed Admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await User.create({ email: 'admin@admin.com', password: hashedPassword, role: 'admin' });
    console.log('Admin seeded');
    
    // Seed Products
    await Product.insertMany([
      { 
        name: 'Burger Clásica', 
        description: 'Medallón de 120g, cheddar, lechuga y tomate.',
        price: 5000, 
        stock: 100, 
        categorySlug: 'hamburguesas', 
        isActive: true,
        optionGroups: [
          {
            name: 'Toppings Extra',
            minSelect: 0,
            maxSelect: 10,
            options: [
              { name: 'Extra Cheddar', additionalPrice: 500 },
              { name: 'Bacon', additionalPrice: 800 },
            ]
          }
        ]
      },
      { 
        name: 'Combo Burger Doble', 
        description: 'Doble medallón, incluye papas y bebida.',
        price: 8500, 
        stock: 50, 
        categorySlug: 'combos', 
        isActive: true,
        optionGroups: [
          {
            name: 'Elegí tu bebida',
            minSelect: 0,
            maxSelect: 5,
            options: [
              { name: 'Coca Cola', additionalPrice: 0 },
              { name: 'Sprite', additionalPrice: 0 },
              { name: 'Pinta Artesanal', additionalPrice: 1500 },
            ]
          }
        ]
      },
    ]);
    console.log('Products seeded');

    console.log('Seeding Complete');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
