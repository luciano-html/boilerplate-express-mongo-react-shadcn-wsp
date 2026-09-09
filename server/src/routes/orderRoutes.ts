import { Router } from 'express';
import {
  createOrder,
  getOrders,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
} from '../controllers/orderController';
import { getOrderHistory, getOrderStats, getOrderById } from '../controllers/reportController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Publico: la tienda crea pedidos sin login.
router.post('/', createOrder);

// Privado: el tablero y los reportes son del local.
// Las rutas fijas van antes que /:id para que "historial" no se lea como un id.
router.get('/historial', authMiddleware, getOrderHistory);
router.get('/stats', authMiddleware, getOrderStats);
router.get('/', authMiddleware, getOrders);
router.get('/:id', authMiddleware, getOrderById);
router.put('/:id/status', authMiddleware, updateOrderStatus);
router.put('/:id/payment', authMiddleware, updatePaymentStatus);
router.delete('/:id', authMiddleware, deleteOrder);

export default router;
