import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { calculateETA } from '../utils/etaCalculator';
import { whatsappService } from '../services/whatsappService';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const isDelivery = req.body.orderType === 'delivery';
    const estimatedTime = await calculateETA(isDelivery);

    const initialStatus = req.body.paymentMethod === 'transfer' ? 'pending_payment' : 'pending';

    const order = await Order.create({
      ...req.body,
      status: initialStatus,
      estimatedTime,
    });

    // Enviar WhatsApp (Nuevo pedido)
    // El ticket completo se enviará si es pending, si es pending_payment se puede enviar instruccion de pago
    if (initialStatus === 'pending') {
      const msg = `Hola ${order.customerName}, recibimos tu pedido. El tiempo estimado es de ${estimatedTime} minutos. Total a pagar: $${order.total}.`;
      await whatsappService.sendMessage(order.customerPhone, msg).catch(console.error);
    } else {
      const msg = `Hola ${order.customerName}, recibimos tu pedido. Por favor realiza la transferencia de $${order.total} y envíanos el comprobante.`;
      await whatsappService.sendMessage(order.customerPhone, msg).catch(console.error);
    }

    res.status(201).json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    await order.save();

    // Reglas de WhatsApp
    if (status === 'in_preparation') {
      // Delay de 2 minutos antes de avisar "Entró a la parrilla"
      setTimeout(async () => {
        const msg = `¡Tu pedido ya entró a la parrilla! Lo estamos preparando.`;
        await whatsappService.sendMessage(order.customerPhone, msg).catch(console.error);
      }, 2 * 60 * 1000);
    }

    if (status === 'dispatched') {
      const msg = order.orderType === 'delivery' 
        ? `¡Tu pedido está en camino! Estate atento!!!` 
        : `¡Tu pedido está listo para retirar por el local! Estate atento!!!`;
      await whatsappService.sendMessage(order.customerPhone, msg).catch(console.error);
    }

    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
