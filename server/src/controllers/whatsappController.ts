import { Request, Response } from 'express';
import { whatsappService } from '../services/whatsappService';

export const getStatus = (req: Request, res: Response) => {
  const isConnected = whatsappService.getStatus();
  const qr = whatsappService.getQrCode();

  res.json({
    connected: isConnected,
    // `running` distingue "no hay QR porque todavia no llego" de
    // "no hay QR porque el bot esta apagado". La UI necesita esa diferencia.
    running: whatsappService.getRunning(),
    // false = apagado a nivel instalacion; la UI tiene que decirlo, no ofrecer un QR que nunca va a llegar.
    enabled: whatsappService.getEnabled(),
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

export const restart = async (req: Request, res: Response) => {
  try {
    const result = await whatsappService.restartClient();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
