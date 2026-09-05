import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController';

const router = Router();

router.post('/', createOrder);
router.get('/', getOrders);
router.put('/:id/status', updateOrderStatus);

export default router;
