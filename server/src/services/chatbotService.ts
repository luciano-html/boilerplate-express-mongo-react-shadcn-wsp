import { Product } from '../models/Product';
import { StoreConfig } from '../models/StoreConfig';
import { Order } from '../models/Order';
import { whatsappService } from './whatsappService';

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

export const handleIncomingMessage = async (from: string, body: string, senderName: string) => {
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
    
    const newOrder = await Order.create({
      items: session.cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice
      })),
      total,
      customerName: session.customerName,
      customerPhone: session.phone,
      orderType: session.orderType,
      deliveryNeighborhood: session.address,
      paymentMethod: session.paymentMethod,
      status: session.paymentMethod === 'transfer' ? 'pending_payment' : 'pending'
    });

    let msg = `🎉 *¡Pedido confirmado!* Tu número de orden es #${newOrder._id.toString().slice(-4)}.\n\n`;
    if (session.paymentMethod === 'transfer') {
      msg += `Por favor, transfiere el total ($${total}) al alias: *NUESTRO.ALIAS.AQUI* y envíanos el comprobante por este medio.\n\n`;
    }
    msg += `Te avisaremos por aquí cuando tu pedido esté en camino/listo. ¡Gracias por elegirnos!`;

    await whatsappService.sendMessage(from, msg);
    sessions.delete(from); // Clear session

  } else {
    await whatsappService.sendMessage(from, 'No te entendí. Responde *CONFIRMAR* o *CANCELAR*.');
  }
}
