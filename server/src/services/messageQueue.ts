import { PendingMessage } from '../models/PendingMessage';
import { Order } from '../models/Order';
import { whatsappService } from './whatsappService';
import logger from '../utils/logger';

const POLL_INTERVAL_MS = Number(process.env.MESSAGE_QUEUE_POLL_MS ?? 15_000);
const MAX_ATTEMPTS = 5;

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Encola un mensaje para mas tarde.
 *
 * El delay de 2 minutos del Spec estaba hecho con setTimeout: si el server se
 * reiniciaba en esa ventana, el mensaje se perdia sin dejar rastro y el cliente
 * nunca se enteraba de que su pedido habia entrado a la parrilla. Guardarlo en
 * Mongo hace que sobreviva a reinicios, deploys y caidas.
 */
export async function scheduleMessage(params: {
  to: string;
  body: string;
  delayMs: number;
  orderId?: any;
  onlyIfStatusIn?: string[];
}) {
  await PendingMessage.create({
    to: params.to,
    body: params.body,
    sendAfter: new Date(Date.now() + params.delayMs),
    orderId: params.orderId,
    onlyIfStatusIn: params.onlyIfStatusIn,
  });
}

async function drain() {
  if (running) return;
  running = true;

  try {
    const due = await PendingMessage.find({
      sentAt: null,
      sendAfter: { $lte: new Date() },
      attempts: { $lt: MAX_ATTEMPTS },
    }).limit(20);

    for (const msg of due) {
      // El estado pudo cambiar durante la espera. Avisar "entro a la parrilla"
      // de un pedido que mientras tanto se cancelo es peor que no avisar nada.
      if (msg.onlyIfStatusIn?.length && msg.orderId) {
        const order = await Order.findById(msg.orderId).select('status').lean<{ status: string } | null>();
        if (!order || !msg.onlyIfStatusIn.includes(order.status)) {
          msg.sentAt = new Date();
          msg.lastError = `descartado: la orden quedo en "${order?.status ?? 'inexistente'}"`;
          await msg.save();
          continue;
        }
      }

      try {
        await whatsappService.sendMessage(msg.to, msg.body);
        msg.sentAt = new Date();
        await msg.save();
      } catch (err: any) {
        msg.attempts += 1;
        msg.lastError = err.message;
        await msg.save();
        logger.error(
          `Mensaje diferido fallo (intento ${msg.attempts}/${MAX_ATTEMPTS}) para ${msg.to}: ${err.message}`
        );
      }
    }
  } catch (err: any) {
    logger.error(`Error procesando la cola de mensajes: ${err.message}`);
  } finally {
    running = false;
  }
}

export function startMessageQueue() {
  if (timer) return;
  timer = setInterval(drain, POLL_INTERVAL_MS);
  logger.info(`Cola de mensajes diferidos activa (cada ${POLL_INTERVAL_MS / 1000}s)`);
}

export function stopMessageQueue() {
  if (timer) clearInterval(timer);
  timer = null;
}
