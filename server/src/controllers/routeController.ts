import { Request, Response } from 'express';
import { DeliveryRoute } from '../models/DeliveryRoute';
import { Order } from '../models/Order';
import { nextSequence } from '../models/Counter';
import { notifyCustomer } from '../services/orderService';
import logger from '../utils/logger';

/**
 * Una hoja de ruta agrupa los pedidos que sale a repartir un cadete.
 *
 * Despachar la hoja es lo que mueve los pedidos a `on_the_way`, y eso dispara
 * el aviso de "está en camino" a cada cliente. Es la razón de ser del módulo:
 * sin esto alguien tiene que arrastrar seis tarjetas de a una en el Kanban
 * mientras el cadete espera con el casco puesto.
 */

/** Los candidatos: delivery, ya cocinados, sin ruta asignada. */
export const getAvailableOrders = async (_req: Request, res: Response) => {
  try {
    const assigned = await DeliveryRoute.find({ status: { $ne: 'closed' } }).distinct('stops');

    const orders = await Order.find({
      orderType: 'delivery',
      status: 'ready',
      _id: { $nin: assigned },
    })
      .sort({ createdAt: 1 })
      .select('orderNumber customerName customerPhone deliveryAddress deliveryNeighborhood deliveryCity total paymentStatus createdAt')
      .lean();

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRoutes = async (req: Request, res: Response) => {
  try {
    const filter = req.query.all === 'true' ? {} : { status: { $ne: 'closed' } };
    const routes = await DeliveryRoute.find(filter)
      .sort({ createdAt: -1 })
      .populate(
        'stops',
        'orderNumber customerName customerPhone deliveryAddress deliveryNeighborhood total paymentStatus status'
      )
      .lean();
    res.json(routes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createRoute = async (req: Request, res: Response) => {
  try {
    const courierName = String(req.body.courierName ?? '').trim();
    if (!courierName) return res.status(400).json({ error: 'Falta el nombre del cadete' });

    const route = await DeliveryRoute.create({
      routeNumber: await nextSequence('route'),
      courierName,
      stops: [],
      status: 'open',
    });

    res.status(201).json(route);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** Reemplaza las paradas completas: el array que llega ES el orden final. */
export const updateStops = async (req: Request, res: Response) => {
  try {
    const route = await DeliveryRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    if (route.status !== 'open') {
      return res.status(409).json({ error: 'La hoja ya salió; no se pueden cambiar las paradas' });
    }

    const stops = Array.isArray(req.body.stops) ? req.body.stops : [];

    // Un pedido no puede estar en dos hojas: el cadete que llega segundo se
    // encuentra con que ya lo entregaron.
    const enOtras = await DeliveryRoute.findOne({
      _id: { $ne: route._id },
      status: { $ne: 'closed' },
      stops: { $in: stops },
    });
    if (enOtras) {
      return res.status(409).json({ error: `Alguno de esos pedidos ya está en la hoja #${enOtras.routeNumber}` });
    }

    route.stops = stops;
    await route.save();

    const populated = await route.populate(
      'stops',
      'orderNumber customerName customerPhone deliveryAddress deliveryNeighborhood total paymentStatus status'
    );
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * El cadete sale. Mueve todos los pedidos de la hoja a `on_the_way` y le avisa
 * a cada cliente. Es la operación que justifica el módulo.
 */
export const dispatchRoute = async (req: Request, res: Response) => {
  try {
    const route = await DeliveryRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    if (route.status !== 'open') return res.status(409).json({ error: 'Esta hoja ya salió' });
    if (route.stops.length === 0) return res.status(400).json({ error: 'La hoja no tiene pedidos' });

    const orders = await Order.find({ _id: { $in: route.stops } });

    // Misma guarda que en el tablero: nada sale sin el pago confirmado cuando
    // había algo que confirmar.
    const sinPago = orders.filter((o) => o.paymentStatus === 'pending');
    if (sinPago.length > 0) {
      return res.status(409).json({
        error: `Falta confirmar el pago de: ${sinPago.map((o) => `#${o.orderNumber}`).join(', ')}`,
      });
    }

    for (const order of orders) {
      if (order.status === 'closed' || order.status === 'cancelled') continue;

      const yaEstuvo = order.statusHistory.some((e: any) => e.status === 'on_the_way');
      order.status = 'on_the_way';
      order.statusHistory.push({ status: 'on_the_way', at: new Date() } as any);
      await order.save();

      if (!yaEstuvo) {
        await notifyCustomer(
          order,
          `Tu pedido #${order.orderNumber} está en camino. Estate atento!`,
          'on_the_way'
        );
      }
    }

    route.status = 'dispatched';
    route.dispatchedAt = new Date();
    await route.save();

    req.app.get('io').emit('order:updated', { routeId: route._id });
    logger.info(`Hoja de ruta #${route.routeNumber} despachada con ${orders.length} pedidos`);

    res.json(route);
  } catch (error: any) {
    logger.error(`Error despachando la hoja: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

/** El cadete volvió: se cierran los pedidos que siguen abiertos. */
export const closeRoute = async (req: Request, res: Response) => {
  try {
    const route = await DeliveryRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Hoja de ruta no encontrada' });

    const orders = await Order.find({
      _id: { $in: route.stops },
      status: { $nin: ['closed', 'cancelled'] },
    });

    for (const order of orders) {
      order.status = 'closed';
      order.statusHistory.push({ status: 'closed', at: new Date() } as any);
      await order.save();
    }

    route.status = 'closed';
    route.closedAt = new Date();
    await route.save();

    req.app.get('io').emit('order:updated', { routeId: route._id });
    res.json(route);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRoute = async (req: Request, res: Response) => {
  try {
    const route = await DeliveryRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    if (route.status === 'dispatched') {
      return res.status(409).json({ error: 'No se puede borrar una hoja que ya salió. Cerrala.' });
    }
    await route.deleteOne();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
