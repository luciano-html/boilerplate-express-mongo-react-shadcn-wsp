import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { getPagination, getSkip } from '../utils/pagination';

/**
 * Zona horaria con la que se agrupa por día. Un pedido de las 23:40 del sábado
 * pertenece al sábado del local, no al domingo UTC. Sin esto, todo el corte de
 * caja de un local argentino queda partido al medio.
 */
const TZ = process.env.REPORT_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

/** Estados que cuentan como venta. Un cancelado no factura. */
const SOLD = ['closed'];

function parseRange(req: Request) {
  const now = new Date();
  const to = req.query.to ? new Date(String(req.query.to)) : now;

  // Por defecto, los últimos 30 días: abrir el módulo y ver algo es mejor que
  // abrirlo y ver un formulario vacío.
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // `to` inclusive: quien filtra "hasta el 9" espera que entre el 9 entero.
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/**
 * Historial paginado. Devuelve solo lo que la tabla muestra: traerse los
 * `items` completos de mil pedidos para listar fecha, cliente y total es
 * regalar ancho de banda.
 */
export const getOrderHistory = async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const filter: Record<string, unknown> = { createdAt: { $gte: from, $lte: to } };

    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.orderType) filter.orderType = String(req.query.orderType);
    if (req.query.paymentMethod) filter.paymentMethod = String(req.query.paymentMethod);

    if (req.query.q) {
      const q = String(req.query.q).trim();
      const asNumber = Number(q);
      filter.$or = [
        { customerName: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q.replace(/\D/g, ''), $options: 'i' } },
        ...(Number.isFinite(asNumber) ? [{ orderNumber: asNumber }] : []),
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(getSkip(page, limit))
        .limit(limit)
        .select('orderNumber customerName customerPhone orderType paymentMethod paymentStatus status total estimatedTime deliveryNeighborhood createdAt')
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ data: orders, pagination: getPagination(page, limit, total) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Agregados de facturación.
 *
 * Todo se calcula en Mongo, no en Node: traerse seis meses de pedidos para
 * sumarlos en memoria funciona hasta que el local vende de verdad.
 */
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const groupBy = ['day', 'month', 'year'].includes(String(req.query.groupBy))
      ? String(req.query.groupBy)
      : 'day';

    const format = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'month' ? '%Y-%m' : '%Y';
    const match = { createdAt: { $gte: from, $lte: to }, status: { $in: SOLD } };

    const [series, totals, byType, byPayment, topProducts] = await Promise.all([
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: '$createdAt', timezone: TZ } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, period: '$_id', revenue: 1, orders: 1 } },
      ]),

      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
            avgTicket: { $avg: '$total' },
          },
        },
        { $project: { _id: 0, revenue: 1, orders: 1, avgTicket: { $round: ['$avgTicket', 0] } } },
      ]),

      Order.aggregate([
        { $match: match },
        { $group: { _id: '$orderType', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', revenue: 1, orders: 1 } },
      ]),

      Order.aggregate([
        { $match: match },
        { $group: { _id: '$paymentMethod', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', revenue: 1, orders: 1 } },
      ]),

      // Qué se vende, no solo cuánto. Es el dato que decide qué sacar de la carta.
      Order.aggregate([
        { $match: match },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $ifNull: ['$items.name', 'Sin nombre'] },
            units: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
          },
        },
        { $sort: { units: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: '$_id', units: 1, revenue: 1 } },
      ]),
    ]);

    // Los cancelados se cuentan aparte: no facturan pero dicen algo del local.
    const cancelled = await Order.countDocuments({
      createdAt: { $gte: from, $lte: to },
      status: 'cancelled',
    });

    res.json({
      range: { from, to, groupBy, timezone: TZ },
      totals: totals[0] ?? { revenue: 0, orders: 0, avgTicket: 0 },
      cancelled,
      series,
      byType,
      byPayment,
      topProducts,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** Un pedido completo, con todo lo que el historial no trae. */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
