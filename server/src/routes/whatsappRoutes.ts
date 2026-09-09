import { Router } from 'express';
import { getStatus, testMessage, restart } from '../controllers/whatsappController';

import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/status', getStatus);
router.post('/send', authMiddleware, testMessage);
router.post('/restart', authMiddleware, restart);

export default router;
