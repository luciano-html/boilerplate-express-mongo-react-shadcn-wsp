import { Product } from '../models/Product';
import { StoreConfig } from '../models/StoreConfig';
import { Order } from '../models/Order';
import { whatsappService } from './whatsappService';
import { createOrderRecord, matchDeliveryZone } from './orderService';
import { extractHandshakeCode } from '../utils/handshakeCode';

type SessionState = 'GREETING' | 'SELECTING_ITEMS' | 'ASK_ORDER_TYPE' | 'ASK_ADDRESS' | 'ASK_PAYMENT' | 'CONFIRMATION';

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface ChatSession {
  phone: string;
  state: SessionState;
  cart: CartItem[];
  customerName?: string;
  orderType?: 'delivery' | 'takeaway';
  address?: string;
  paymentMethod?: 'cash' | 'transfer';
  lastActive: Date;
}

const sessions = new Map<string, ChatSession>();

/** Media hora: pasado eso el codigo no vincula nada. */
const HANDSHAKE_WINDOW_MS = 30 * 60 * 1000;

/**
 * El cliente armo el pedido en la tienda y llega con un codigo. Vincular ese
 * codigo nos deja el JID REAL desde el que escribio, que es lo que necesita
 * sendMessage -- y no el telefono que tipeo en un formulario, que puede tener
 * un typo, ser el fijo de la casa o estar sin el 9.
 *
 * Devuelve true si manejo el mensaje.
 */
async function tryHandshake(from: string, body: string): Promise<boolean> {
  const code = extractHandshakeCode(body);
  if (!code) return false;

  const order = await Order.findOne({
    handshakeCode: code,
    customerJid: { $exists: false },
    createdAt: { $gte: new Date(Date.now() - HANDSHAKE_WINDOW_MS) },
    status: { $nin: ['closed', 'cancelled'] },
  });

  if (!order) {
    // Codigo vencido, ya usado o inventado. No se dice cual: no hace falta
    // contarle a nadie que ese codigo existio.
    await whatsappService.sendMessage(
      from,
      'No encontré ese pedido. Puede que haya pasado mucho tiempo. Escribí *HOLA* y lo armamos por acá.'
    );
    return true;
  }

  order.customerJid = from;
  order.confirmedAt = new Date();
  await order.save();

  const detalle = order.items
    .map((i: any) => `${i.quantity}x ${i.name ?? 'Producto'}`)
    .join('\n');

  let msg = `Listo, ${order.customerName}. Tu pedido *#${order.orderNumber}* quedó confirmado.\n\n${detalle}\n\n`;
  msg += `*Total:* $${order.total}\n`;
  msg += `*Tiempo estimado:* ${order.estimatedTime} minutos\n\n`;
  if (order.paymentStatus === 'pending') {
    const alias = (await StoreConfig.findOne())?.transferAlias;
    msg += alias
      ? `Transferí al alias *${alias}* y mandanos el comprobante por acá. Hasta que no lo veamos, no entra a la cocina.\n\n`
      : `Mandanos el comprobante de la transferencia por acá. Hasta que no lo veamos, no entra a la cocina.\n\n`;
  }
  msg += 'Te vamos avisando por este chat.';

  await whatsappService.sendMessage(from, msg);
  return true;
}

export const handleIncomingMessage = async (from: string, body: string, senderName: string) => {
  // El handshake va primero: quien llega con un codigo no quiere el menu
  // conversacional, ya eligió en la web.
  if (await tryHandshake(from, body)) return;

  const text = body.trim().toLowerCase();
  let session = sessions.get(from);

  // If user says "cancelar", reset
  if (text === 'cancelar' || text === 'salir') {
    sessions.delete(from);
    await whatsappService.sendMessage(from, '❌ Pedido cancelado. Escribe "Hola" cuando quieras volver a pedir.');
    return;
  }

  if (!session) {
    session = {
      phone: from,
      state: 'GREETING',
      cart: [],
      customerName: senderName || 'Cliente',
      lastActive: new Date()
    };
    sessions.set(from, session);
  }

  session.lastActive = new Date();

  switch (session.state) {
    case 'GREETING':
      await handleGreeting(session, from);
      break;
    case 'SELECTING_ITEMS':
      await handleSelectingItems(session, from, text);
      break;
    case 'ASK_ORDER_TYPE':
      await handleAskOrderType(session, from, text);
      break;
    case 'ASK_ADDRESS':
      await handleAskAddress(session, from, body); // keep casing for address
      break;
    case 'ASK_PAYMENT':
      await handleAskPayment(session, from, text);
      break;
    case 'CONFIRMATION':
      await handleConfirmation(session, from, text);
      break;
  }
};

async function handleGreeting(session: ChatSession, from: string) {
  const config = await StoreConfig.findOne();
  const storeName = config?.name || 'nuestro local';
  
  const products = await Product.find({ isActive: true });
  
  if (products.length === 0) {
    await whatsappService.sendMessage(from, `¡Hola! Bienvenido a ${storeName}. En este momento no tenemos productos disponibles. 🙏`);
    sessions.delete(from);
    return;
  }

  let menu = `🍔 *¡Hola ${session.customerName}! Bienvenido a ${storeName}* 🍔\n\n*NUESTRO MENÚ:*\n`;
  products.forEach((p, index) => {
    menu += `*${index + 1}.* ${p.name} - $${p.price}\n`;
    if (p.description) menu += `   _${p.description}_\n`;
  });

  menu += `\n👉 *Responde con el NÚMERO* del producto que deseas agregar a tu carrito.\n(Ejemplo: "1" o "2").\n\n✅ Cuando termines, escribe *LISTO*.`;
  
  await whatsappService.sendMessage(from, menu);
  session.state = 'SELECTING_ITEMS';
}

async function handleSelectingItems(session: ChatSession, from: string, text: string) {
  if (text === 'listo' || text === 'fin' || text === 'ok') {
    if (session.cart.length === 0) {
      await whatsappService.sendMessage(from, 'Tu carrito está vacío. Responde con el número del producto o escribe "cancelar".');
      return;
    }
    await whatsappService.sendMessage(from, '🛵 ¿El pedido es para *Delivery* (envío) o *Takeaway* (retiro en local)?\n\nResponde *ENVIO* o *RETIRO*.');
    session.state = 'ASK_ORDER_TYPE';
    return;
  }

  const index = parseInt(text) - 1;
  const products = await Product.find({ isActive: true });

  if (isNaN(index) || index < 0 || index >= products.length) {
    await whatsappService.sendMessage(from, '❌ Número no válido. Por favor, responde con el número del producto (ej: "1") o escribe *LISTO* si ya terminaste.');
    return;
  }

  const selectedProduct = products[index];
  
  // Add to cart
  const existingItem = session.cart.find(i => i.productId === selectedProduct._id.toString());
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    session.cart.push({
      productId: selectedProduct._id.toString(),
      name: selectedProduct.name,
      quantity: 1,
      unitPrice: selectedProduct.price
    });
  }

  await whatsappService.sendMessage(from, `✅ *${selectedProduct.name}* agregado al carrito.\n\n¿Quieres algo más? Escribe el número, o escribe *LISTO* para continuar.`);
}

async function handleAskOrderType(session: ChatSession, from: string, text: string) {
  if (text.includes('envio') || text.includes('envío') || text.includes('delivery')) {
    session.orderType = 'delivery';
    await whatsappService.sendMessage(from, '📍 Por favor, escribe tu *dirección exacta* de envío (Calle, número, barrio):');
    session.state = 'ASK_ADDRESS';
  } else if (text.includes('retiro') || text.includes('take') || text.includes('local')) {
    session.orderType = 'takeaway';
    await askPaymentMethod(session, from);
  } else {
    await whatsappService.sendMessage(from, 'No te entendí. Responde *ENVIO* o *RETIRO*.');
  }
}

async function handleAskAddress(session: ChatSession, from: string, text: string) {
  session.address = text;
  await askPaymentMethod(session, from);
}

async function askPaymentMethod(session: ChatSession, from: string) {
  await whatsappService.sendMessage(from, '💳 ¿Cómo vas a abonar?\n\nResponde *EFECTIVO* o *TRANSFERENCIA*.');
  session.state = 'ASK_PAYMENT';
}

async function handleAskPayment(session: ChatSession, from: string, text: string) {
  if (text.includes('efectivo')) {
    session.paymentMethod = 'cash';
  } else if (text.includes('transf') || text.includes('alias')) {
    session.paymentMethod = 'transfer';
  } else {
    await whatsappService.sendMessage(from, 'No te entendí. Responde *EFECTIVO* o *TRANSFERENCIA*.');
    return;
  }

  // Summary
  let total = 0;
  let summary = `📋 *RESUMEN DE TU PEDIDO:*\n\n`;
  session.cart.forEach(item => {
    const subtotal = item.quantity * item.unitPrice;
    total += subtotal;
    summary += `${item.quantity}x ${item.name} - $${subtotal}\n`;
  });
  summary += `\n*Total:* $${total}\n`;
  summary += `*Tipo:* ${session.orderType === 'delivery' ? 'Envío' : 'Retiro por local'}\n`;
  if (session.orderType === 'delivery') {
    summary += `*Dirección:* ${session.address}\n`;
  }
  summary += `*Pago:* ${session.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}\n\n`;
  summary += `👉 Responde *CONFIRMAR* para enviar el pedido a la cocina, o *CANCELAR* para descartarlo.`;

  await whatsappService.sendMessage(from, summary);
  session.state = 'CONFIRMATION';
}

async function handleConfirmation(session: ChatSession, from: string, text: string) {
  if (text.includes('confirmar') || text.includes('si') || text.includes('ok')) {
    // Save to DB
    const total = session.cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    
    // La direccion es texto libre y va a deliveryAddress. Antes se guardaba en
    // deliveryNeighborhood, que es la ZONA: con eso el pedido nunca pagaba
    // envio y no se podia agrupar por barrio en las hojas de ruta.
    const zone = session.orderType === 'delivery' && session.address
      ? await matchDeliveryZone(session.address)
      : null;

    const { order: newOrder } = await createOrderRecord({
      items: session.cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      total: total + (zone?.cost ?? 0),
      customerName: session.customerName!,
      customerPhone: session.phone,
      orderType: session.orderType!,
      deliveryCity: zone?.city,
      deliveryNeighborhood: zone?.neighborhood,
      deliveryAddress: session.orderType === 'delivery' ? session.address : undefined,
      paymentMethod: session.paymentMethod!,
    });

    let msg = `🎉 *¡Pedido confirmado!* Tu número de orden es #${newOrder.orderNumber}.\n\n`;
    if (session.paymentMethod === 'transfer') {
      const alias = (await StoreConfig.findOne())?.transferAlias;
      msg += alias
        ? `Por favor, transfiere el total ($${total}) al alias *${alias}* y envíanos el comprobante por este medio.\n\n`
        : `Por favor, transfiere el total ($${total}) y envíanos el comprobante por este medio.\n\n`;
    }
    msg += `Tiempo estimado: *${newOrder.estimatedTime} minutos*.\n\n`;
    msg += `Te avisaremos por aquí cuando tu pedido esté en camino/listo. ¡Gracias por elegirnos!`;

    await whatsappService.sendMessage(from, msg);
    sessions.delete(from); // Clear session

  } else {
    await whatsappService.sendMessage(from, 'No te entendí. Responde *CONFIRMAR* o *CANCELAR*.');
  }
}
