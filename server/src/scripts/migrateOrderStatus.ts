import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Order } from '../models/Order';
import { Counter } from '../models/Counter';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Migra los pedidos al modelo de estados nuevo.
 *
 * Antes un solo campo mezclaba tres ejes: si se cobro, si el cliente confirmo y
 * donde esta el pedido. Ahora:
 *
 *   status         donde esta fisicamente
 *   paymentStatus  si hay algo que verificar antes de cocinar
 *   statusHistory  la traza, que es lo que alimenta el ETA medido
 *
 * Mapeo:
 *   pending_payment -> pending    + paymentStatus pending
 *   pending         -> pending    + confirmed
 *   in_preparation  -> cooking    + confirmed
 *   in_expedition   -> ready      + confirmed
 *   dispatched      -> on_the_way + confirmed
 *   delivered       -> closed     + confirmed
 *   cancelled       -> cancelled  + confirmed
 *
 * Idempotente: los pedidos que ya tienen orderNumber se saltean.
 *
 *   cd server && npx tsx src/scripts/migrateOrderStatus.ts
 */
const STATUS_MAP: Record<string, string> = {
  pending_payment: 'pending',
  pending: 'pending',
  in_preparation: 'cooking',
  in_expedition: 'ready',
  dispatched: 'on_the_way',
  delivered: 'closed',
  cancelled: 'cancelled',
};

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27018/b2b2c-boilerplate');
  console.log('MongoDB conectado');

  // Driver nativo: los campos viejos ya no estan en el schema.
  const col = Order.collection;
  const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
  console.log(`Pedidos a revisar: ${docs.length}`);

  let seq = 0;
  let migrados = 0;

  for (const doc of docs) {
    if (typeof doc.orderNumber === 'number') {
      seq = Math.max(seq, doc.orderNumber);
      continue;
    }

    const legacy: string = doc.status ?? 'pending';
    const status = STATUS_MAP[legacy] ?? (legacy in STATUS_MAP ? legacy : 'pending');
    const paymentStatus = legacy === 'pending_payment' ? 'pending' : 'confirmed';
    const at = doc.updatedAt ?? doc.createdAt ?? new Date();

    seq += 1;

    // La historia real no existe para los pedidos viejos. Se siembra el minimo
    // honesto: entro cuando entro, y quedo en el estado en que quedo. El ETA
    // medido los va a descartar por falta de puntos intermedios, que es correcto:
    // mejor ignorarlos que inventarles duraciones.
    const statusHistory = [{ status: 'pending', at: doc.createdAt ?? at }];
    if (status !== 'pending') statusHistory.push({ status, at });

    await col.updateOne(
      { _id: doc._id },
      {
        $set: { orderNumber: seq, status, paymentStatus, statusHistory },
      }
    );
    migrados += 1;
  }

  await Counter.findByIdAndUpdate('order', { $set: { seq } }, { upsert: true });

  console.log('---');
  console.log(`Migrados: ${migrados}`);
  console.log(`Contador 'order' en: ${seq}`);
}

migrate()
  .catch((err) => {
    console.error('Fallo la migracion:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
