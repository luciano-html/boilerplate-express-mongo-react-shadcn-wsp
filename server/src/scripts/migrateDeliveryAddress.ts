import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Order } from '../models/Order';
import { StoreConfig } from '../models/StoreConfig';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Separa la calle del barrio en los pedidos existentes.
 *
 * El chatbot guardaba la direccion de texto libre dentro de
 * `deliveryNeighborhood`, que es el campo de la ZONA. Resultado: el mismo campo
 * contiene "Centro" (una zona de deliveryZones, que define el costo de envio) o
 * "Santiago del Estero 2778" (texto libre que no matchea nada).
 *
 * Esta migracion mira cada pedido: si el valor coincide con una zona
 * configurada, se queda como esta. Si no, se mueve a `deliveryAddress` y se
 * intenta reconocer la zona adentro del texto.
 *
 * Los pedidos que quedan sin zona reconocida se listan al final: son los que
 * habria que revisar a mano, porque nunca se les cobro el envio.
 *
 *   cd server && npx tsx src/scripts/migrateDeliveryAddress.ts
 */
function normalizar(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27018/b2b2c-boilerplate');
  console.log('MongoDB conectado');

  const config = await StoreConfig.findOne();
  const zones = (config?.deliveryZones ?? []) as any[];
  const porNombre = new Map(zones.map((z) => [normalizar(z.neighborhood), z]));
  console.log(`Zonas configuradas: ${zones.length}`);

  const col = Order.collection;
  const docs = await col.find({ deliveryNeighborhood: { $exists: true, $ne: null } }).toArray();
  console.log(`Pedidos con barrio cargado: ${docs.length}`);

  let intactos = 0;
  let movidos = 0;
  const sinZona: string[] = [];

  for (const doc of docs) {
    if (doc.deliveryAddress) continue; // ya migrado

    const valor: string = doc.deliveryNeighborhood;
    if (porNombre.has(normalizar(valor))) {
      intactos += 1;
      continue;
    }

    // No es una zona: es una direccion que quedo en el campo equivocado.
    const encontrada = [...zones]
      .sort((a, b) => b.neighborhood.length - a.neighborhood.length)
      .find((z) => normalizar(valor).includes(normalizar(z.neighborhood)));

    await col.updateOne(
      { _id: doc._id },
      encontrada
        ? { $set: { deliveryAddress: valor, deliveryNeighborhood: encontrada.neighborhood, deliveryCity: encontrada.city } }
        : { $set: { deliveryAddress: valor }, $unset: { deliveryNeighborhood: '' } }
    );

    movidos += 1;
    if (!encontrada) sinZona.push(`#${doc.orderNumber ?? doc._id}: "${valor}"`);
  }

  console.log('---');
  console.log(`Ya eran zonas validas: ${intactos}`);
  console.log(`Direcciones movidas a deliveryAddress: ${movidos}`);
  if (sinZona.length) {
    console.log(`\nSin zona reconocida (${sinZona.length}) -- nunca se les cobro envio:`);
    sinZona.forEach((l) => console.log(`  ${l}`));
  }
}

migrate()
  .catch((err) => {
    console.error('Fallo la migracion:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
