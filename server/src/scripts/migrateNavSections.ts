import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { StoreConfig } from '../models/StoreConfig';
import { Product } from '../models/Product';
import { slugify } from '../utils/slugify';
import type { NavSection } from 'shared/index';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Migra las categorias de texto libre a NavSections.
 *
 * Antes:   Product.category     = "Hamburguesas"  (el label visible)
 * Despues: Product.categorySlug = "hamburguesas"  (el slug estable)
 *
 * El label pasa a vivir en StoreConfig.navSections, donde el duenio lo puede
 * renombrar sin romper la asociacion con los productos.
 *
 * Usa el driver nativo (Product.collection) a proposito: el campo viejo
 * `category` ya no existe en el schema, asi que Mongoose lo filtraria.
 *
 * Es idempotente: correrlo dos veces no cambia nada la segunda vez.
 *
 *   cd server && npx tsx src/scripts/migrateNavSections.ts
 */
async function migrate() {
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://localhost:27018/b2b2c-boilerplate'
  );
  console.log('MongoDB conectado');

  const config = await StoreConfig.findOne();
  if (!config) {
    console.log('No hay StoreConfig. Corre el seed primero.');
    return;
  }

  const existing: NavSection[] = (config.navSections ?? []) as NavSection[];
  const bySlug = new Map<string, NavSection>(existing.map((s) => [s.slug, s]));

  const legacy: string[] = await Product.collection.distinct('category');
  const already: string[] = await Product.collection.distinct('categorySlug');
  const rawCategories = [...new Set([...legacy, ...already])].filter(Boolean);
  console.log(`Categorias encontradas en productos: ${rawCategories.length}`);

  let order = existing.length;
  let productsUpdated = 0;

  for (const raw of rawCategories) {
    if (!raw) continue;
    const slug = slugify(raw);
    if (!slug) {
      console.log(`  ! "${raw}" no produce un slug valido, se saltea`);
      continue;
    }

    if (!bySlug.has(slug)) {
      const section: NavSection = {
        slug,
        label: raw,
        type: 'category',
        order: order++,
        isActive: true,
      };
      bySlug.set(slug, section);
      console.log(`  + NavSection "${raw}" -> slug "${slug}"`);
    }

    const result = await Product.collection.updateMany(
      { category: raw },
      { $set: { categorySlug: slug }, $unset: { category: '' } }
    );
    if (result.modifiedCount > 0) {
      productsUpdated += result.modifiedCount;
      console.log(`    ${result.modifiedCount} producto(s) reapuntado(s) a "${slug}"`);
    }
  }

  config.navSections = Array.from(bySlug.values())
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i })) as NavSection[];

  await config.save();

  console.log('---');
  console.log(`NavSections: ${config.navSections.length}`);
  console.log(`Productos actualizados: ${productsUpdated}`);
}

migrate()
  .catch((err) => {
    console.error('Fallo la migracion:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
