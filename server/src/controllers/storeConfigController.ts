import { Request, Response } from 'express';
import { StoreConfig } from '../models/StoreConfig';

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
    let config = await StoreConfig.findOne();
    if (!config) {
      config = await StoreConfig.create(req.body);
    } else {
      config = await StoreConfig.findByIdAndUpdate(config._id, req.body, { new: true });
    }
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
