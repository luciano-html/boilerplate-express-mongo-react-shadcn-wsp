import { Router } from 'express';
import {
  getAvailableOrders,
  getRoutes,
  createRoute,
  updateStops,
  dispatchRoute,
  closeRoute,
  deleteRoute,
} from '../controllers/routeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Todo el módulo es del local: ningún endpoint es público.
router.use(authMiddleware);

// Las rutas fijas antes que /:id.
router.get('/disponibles', getAvailableOrders);
router.get('/', getRoutes);
router.post('/', createRoute);
router.put('/:id/stops', updateStops);
router.put('/:id/dispatch', dispatchRoute);
router.put('/:id/close', closeRoute);
router.delete('/:id', deleteRoute);

export default router;
