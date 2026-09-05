import { Router } from 'express';
import { login, me } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.get('/me', authMiddleware, me);

export default router;
