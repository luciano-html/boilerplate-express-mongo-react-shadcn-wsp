import { Request, Response } from 'express';
import { StoreConfig } from '../models/StoreConfig';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { whatsappService } from '../services/whatsappService';
import type { NavSection } from 'shared/index';

export const getConfig = async (req: Request, res: Response) => {
  try {
    let config = await StoreConfig.findOne();
    if (!config) {
      config = await StoreConfig.create({
        name: 'My Store',
        whatsapp: '1234567890',
        currency: 'USD',
      });
    }
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConfig = async (req: Request, res: Response) => {
  try {
    // El navbar tiene su propio endpoint (PUT /api/config/nav) con validacion
    // e invariantes propias. Lo sacamos aca para que un PUT generico no lo pise.
    const { navSections, ...rest } = req.body ?? {};

    let config = await StoreConfig.findOne();
    const wasBotActive = config?.isBotActive ?? false;

    if (!config) {
      config = await StoreConfig.create(rest);
    } else {
      config = await StoreConfig.findByIdAndUpdate(config._id, rest, { new: true });
    }

    // El toggle de Configuracion escribe isBotActive por aca. Si no aplicamos el
    // cambio en caliente, el flag no hace nada hasta el proximo reinicio del
    // server, que es justamente lo que hacia que el bot arrancara siempre.
    const isBotActive = config?.isBotActive ?? false;
    if (isBotActive !== wasBotActive) {
      if (isBotActive) {
        await whatsappService.start();
      } else {
        await whatsappService.stop();
      }
    }

    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reemplaza el navbar completo. El body ya viene validado por navValidator.
 *
 * Invariante que se defiende aca: no se puede borrar una NavSection de tipo
 * 'category' si todavia hay productos apuntando a su slug. Si se pudiera, esos
 * productos quedarian huerfanos y no se renderizarian en ningun lado.
 *
 * El `order` se reasigna por posicion del array: el cliente manda el orden que
 * quiere y no tiene que llevar la cuenta.
 */
export const updateNavSections = async (req: Request, res: Response) => {
  const { navSections } = req.body as { navSections: NavSection[] };

  const config = await StoreConfig.findOne();
  if (!config) {
    throw ApiError.notFound('No hay configuracion de tienda');
  }

  const incoming = new Set(
    navSections.filter((s) => s.type === 'category').map((s) => s.slug)
  );
  const currentCategorySlugs = (config.navSections ?? [])
    .filter((s) => s.type === 'category')
    .map((s) => s.slug);

  const removed = currentCategorySlugs.filter((slug) => !incoming.has(slug));
  if (removed.length > 0) {
    const inUse: string[] = await Product.distinct('categorySlug', {
      categorySlug: { $in: removed },
    });
    if (inUse.length > 0) {
      throw ApiError.conflict(
        `No se pueden eliminar categorias con productos asociados: ${inUse.join(', ')}`
      );
    }
  }

  config.navSections = navSections.map((section, index) => ({
    ...section,
    order: index,
  })) as NavSection[];

  await config.save();
  res.json(config);
};
