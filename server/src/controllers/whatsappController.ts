import { Request, Response } from 'express';
import { whatsappService } from '../services/whatsappService';

export const getStatus = (req: Request, res: Response) => {
  const isConnected = whatsappService.getStatus();
  const qr = whatsappService.getQrCode();

  res.json({
    connected: isConnected,
    qr: isConnected ? null : qr
  });
};

export const testMessage = async (req: Request, res: Response) => {
  const { to, message } = req.body;

  try {
    await whatsappService.sendMessage(to, message);
    res.json({ success: true, message: 'Message sent' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
