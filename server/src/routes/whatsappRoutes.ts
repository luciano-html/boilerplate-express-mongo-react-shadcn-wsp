import { Router } from 'express';
import { getStatus, testMessage } from '../controllers/whatsappController';

const router = Router();

router.get('/status', getStatus);
router.post('/send', testMessage);

export default router;
