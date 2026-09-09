import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { createOrderRecord, notifyCustomer } from '../services/orderService';
import { scheduleMessage } from '../services/messageQueue';
import { validateOrderData } from '../utils/orderValidator';
import logger from '../utils/logger';
import { ACTIVE_ORDER_STATUSES, type OrderStatus } from 'shared/index';

const TERMINAL: OrderStatus[] = ['closed', 'cancelled'];

/** Minutos de espera antes de avisar "entro a la parrilla" (regla del Spec). */
const COOKING_NOTICE_DELAY_MS = 2 * 60 * 1000;

export const createOrder = async (req: Request, res: Response) => {
  try {
    const validation = await validateOrderData(req.body);
    if (!validation.isValid) {
      logger.warn(`Pedido rechazado por validacion: ${validation.error}`);
      return res.status(409).json({ error: validation.error });
    }

    const { order } = await createOrderRecord({
      ...req.body,
      total: validation.computedTotal, // siempre el calculado en el server
    });

    req.app.get('io').emit('order:created', order);

    const body =
      order.paymentStatus === 'pending'
        ? `Hola ${order.customerName}, recibimos tu pedido #${order.orderNumber}. Por favor realiza la transferencia de $${order.total} y envianos el comprobante.`
        : `Hola ${order.customerName}, recibimos tu pedido #${order.orderNumber}. El tiempo estimado es de ${order.estimatedTime} minutos. Total a pagar: $${order.total}.`;

    await notifyCustomer(order, body, 'confirmacion');

    res.status(201).json(order);
  } catch (error: any) {
    logger.error(`Error creando el pedido: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = req.body.status as OrderStatus;

    if (![...ACTIVE_ORDER_STATUSES, ...TERMINAL].includes(status)) {
      return res.status(400).json({ error: `Estado invalido: ${status}` });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    if (TERMINAL.includes(order.status as OrderStatus)) {
      return res.status(409).json({ error: `El pedido ya esta ${order.status}` });
    }
    if (order.status === status) {
      return res.json(order);
    }

    // Un pedido solo se despacha una vez que alguien confirmo el pago cuando habia
    // algo que confirmar. Sin esta guarda, una transferencia sin comprobante sale
    // por la puerta igual que cualquier otra.
    if (status === 'on_the_way' && order.paymentStatus === 'pending') {
      return res.status(409).json({ error: 'Falta confirmar el pago antes de despachar' });
    }

    // Solo se avisa la PRIMERA vez que el pedido entra a un estado. Si el operario
    // arrastra la tarjeta de ida y de vuelta, el cliente no recibe el mismo
    // mensaje dos veces.
    const yaEstuvo = order.statusHistory.some((e) => e.status === status);

    order.status = status;
    order.statusHistory.push({ status, at: new Date() });
    await order.save();

    if (!yaEstuvo) {
      await notifyStatusChange(order, status);
    }

    req.app.get('io').emit('order:updated', order);
    res.json(order);
  } catch (error: any) {
    logger.error(`Error actualizando el estado: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

async function notifyStatusChange(order: any, status: OrderStatus) {
  if (status === 'cooking') {
    // Diferido y durable: si el server se reinicia en el medio, igual sale.
    await scheduleMessage({
      to: order.customerPhone,
      body: `Tu pedido #${order.orderNumber} ya entro a la parrilla. Lo estamos preparando.`,
      delayMs: COOKING_NOTICE_DELAY_MS,
      orderId: order._id,
      onlyIfStatusIn: ['cooking', 'ready', 'on_the_way', 'closed'],
    });
    return;
  }

  // 'ready' significa cosas distintas segun el tipo: para takeaway es el aviso
  // que el cliente espera; para delivery todavia no paso nada que le importe,
  // el aviso util es cuando sale el cadete.
  if (status === 'ready' && order.orderType === 'takeaway') {
    await notifyCustomer(order, `Tu pedido #${order.orderNumber} esta listo para retirar por el local.`, 'ready');
    return;
  }

  if (status === 'on_the_way') {
    await notifyCustomer(order, `Tu pedido #${order.orderNumber} esta en camino. Estate atento!`, 'on_the_way');
  }
}

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!['pending', 'confirmed'].includes(paymentStatus)) {
      return res.status(400).json({ error: `Estado de pago invalido: ${paymentStatus}` });
    }

    const order = await Order.findByIdAndUpdate(id, { paymentStatus }, { new: true });
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    req.app.get('io').emit('order:updated', order);
    res.json(order);
  } catch (error: any) {
    logger.error(`Error actualizando el pago: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    // ?active=true devuelve solo lo que va al tablero. Sin esto el Kanban se
    // trae todo el historico del local en cada refresco.
    const query = req.query.active === 'true' ? { status: { $in: ACTIVE_ORDER_STATUSES } } : {};
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    req.app.get('io').emit('order:updated', order);
    res.json({ success: true, message: 'Pedido eliminado' });
  } catch (error: any) {
    logger.error(`Error eliminando el pedido: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};
