import { Router } from 'express';
import { getConfig, updateConfig, updateNavSections } from '../controllers/storeConfigController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { updateNavSectionsSchema } from '../validators/navValidator';

const router = Router();

// Publico: el storefront necesita la config (incluido el navbar) sin loguearse.
router.get('/', getConfig);

// Privado: solo el admin cambia la configuracion de la tienda.
router.put('/', authMiddleware, updateConfig);
router.put('/nav', authMiddleware, validate(updateNavSectionsSchema), updateNavSections);

export default router;
