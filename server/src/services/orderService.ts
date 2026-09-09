import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { nextSequence } from '../models/Counter';
import { calculateETA, type EtaBreakdown } from '../utils/etaCalculator';
import { generateHandshakeCode } from '../utils/handshakeCode';

/**
 * Unico lugar que sabe como nace un pedido.
 *
 * Antes habia dos: el controller (tienda web) y el chatbot de WhatsApp. Se
 * fueron separando y el del chatbot quedo sin ETA, sin costo de envio y
 * escribiendo estados que ya no existen. Cualquier regla nueva -- el numero
 * correlativo, la traza de estados, el handshake de la Fase 4 -- hay que
 * escribirla una sola vez o la otra rama se queda atras de nuevo.
 */
export interface CreateOrderInput {
  items: { productId: string; quantity: number; unitPrice: number; selectedOptions?: any[]; notes?: string }[];
  total: number;
  customerName: string;
  customerPhone: string;
  orderType: 'delivery' | 'takeaway';
  deliveryCity?: string;
  /** Zona de StoreConfig.deliveryZones. */
  deliveryNeighborhood?: string;
  /** Calle y numero, texto libre. */
  deliveryAddress?: string;
  paymentMethod: 'cash' | 'transfer';
  discounts?: number;
  surcharges?: number;
  customerJid?: string;
}

export async function createOrderRecord(input: CreateOrderInput): Promise<{ order: any; eta: EtaBreakdown }> {
  const isDelivery = input.orderType === 'delivery';
  const eta = await calculateETA(isDelivery);

  // El pago es un eje aparte del avance fisico. Efectivo nace confirmado porque
  // no hay nada que verificar antes de cocinar.
  const paymentStatus = input.paymentMethod === 'transfer' ? 'pending' : 'confirmed';
  const now = new Date();

  // Snapshot del nombre: el producto se puede renombrar o borrar, el historial
  // de lo que se vendio esa noche no.
  const productIds = input.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).select('name').lean();
  const nameById = new Map(products.map((p: any) => [String(p._id), p.name]));

  const items = input.items.map((item) => ({
    ...item,
    name: nameById.get(String(item.productId)),
  }));

  // Codigo unico entre los pedidos abiertos. No hace falta que sea unico para
  // siempre: se usa dentro de la media hora siguiente y despues no vale.
  let handshakeCode = generateHandshakeCode();
  for (let i = 0; i < 5; i++) {
    const taken = await Order.exists({ handshakeCode, status: { $nin: ['closed', 'cancelled'] } });
    if (!taken) break;
    handshakeCode = generateHandshakeCode();
  }

  const order = await Order.create({
    ...input,
    items,
    handshakeCode,
    orderNumber: await nextSequence('order'),
    status: 'pending',
    paymentStatus,
    statusHistory: [{ status: 'pending', at: now }],
    estimatedTime: eta.total,
  });

  return { order, eta };
}

/**
 * El chatbot recibe la direccion como texto libre ("Santiago del Estero 2778,
 * barrio Sur"). Intenta reconocer ahi una zona configurada para poder cobrar el
 * envio. Si no la encuentra devuelve null y el pedido queda sin costo de envio,
 * marcado para que alguien lo revise en el tablero: cobrar de menos es un
 * problema, adivinar la zona equivocada es peor.
 */
export async function matchDeliveryZone(text: string) {
  const { StoreConfig } = await import('../models/StoreConfig');
  const config = await StoreConfig.findOne();
  if (!config?.deliveryZones?.length) return null;

  const haystack = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const zones = config.deliveryZones.filter((z: any) => z.isActive);
  // El barrio mas largo primero: "Barrio Sur" gana sobre "Sur".
  const sorted = [...zones].sort((a: any, b: any) => b.neighborhood.length - a.neighborhood.length);

  for (const zone of sorted) {
    const needle = zone.neighborhood
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (haystack.includes(needle)) return zone;
  }
  return null;
}


/**
 * Manda un aviso al cliente y, si falla, lo deja anotado en la orden.
 *
 * Los .catch que solo loguean dejan al local creyendo que el cliente fue
 * avisado. Nadie lee error.log un viernes a las 22; el tablero si se mira.
 */
export async function notifyCustomer(order: any, body: string, kind: string) {
  const { whatsappService } = await import('./whatsappService');
  const logger = (await import('../utils/logger')).default;

  try {
    // Si el cliente hizo el handshake tenemos su JID real; ese siempre le gana
    // al telefono que tipeo en el formulario.
    await whatsappService.sendMessage(order.customerJid ?? order.customerPhone, body);
    if (order.lastNotificationError) {
      await Order.updateOne({ _id: order._id }, { $unset: { lastNotificationError: '' } });
    }
  } catch (err: any) {
    logger.error(`Fallo el aviso "${kind}" del pedido ${order.orderNumber}: ${err.message}`);
    await Order.updateOne(
      { _id: order._id },
      { $set: { lastNotificationError: { at: new Date(), message: err.message } } }
    );
  }
}
