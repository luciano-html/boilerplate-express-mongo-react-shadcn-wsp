import { Client, LocalAuth } from 'whatsapp-web.js';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { StoreConfig } from '../models/StoreConfig';
import { normalizeArgentinePhone } from '../utils/phone';

/**
 * INTERRUPTOR DE DEPLOYMENT. Por defecto FALSE: un server recien levantado no le
 * escribe a nadie, pase lo que pase.
 *
 * Es distinto de StoreConfig.isBotActive, que es el toggle del dia a dia. Este
 * vive en el .env, o sea que viaja con la instalacion y no con la base. Sin el,
 * un `isBotActive: true` que quedo guardado hace tres semanas hace que el
 * proximo `npm run dev` empiece a contestarle a gente de verdad sin que nadie lo
 * haya pedido -- que es justo lo que paso el 06/09.
 *
 * Para usar el bot: WHATSAPP_BOT_ENABLED=true en server/.env
 */
const BOT_ENABLED = process.env.WHATSAPP_BOT_ENABLED === 'true';

/**
 * Ventana de gracia, en segundos, para mensajes que llegan tras una RECONEXION
 * (no tras un escaneo de QR). Default 10 minutos.
 */
const MAX_MESSAGE_AGE_SECONDS = Number(process.env.WHATSAPP_MAX_MESSAGE_AGE_SECONDS ?? 600);

export type WhatsappActionResult = {
  success: boolean;
  message?: string;
  reason?: 'bot_disabled' | 'bot_inactive' | 'already_running' | 'restart_in_progress';
  error?: string;
};

/**
 * Cliente de WhatsApp Web.
 *
 * IMPORTANTE: el constructor NO levanta nada. Instanciar este servicio es
 * gratis; lo caro (Chromium) solo arranca en start(). Quien decide arrancarlo
 * es server.ts via bootstrap(), y solo si StoreConfig.isBotActive esta en true.
 *
 * Un deployment que no usa el bot no paga un Chromium en memoria.
 */
class WhatsappService extends EventEmitter {
  private client: Client | null = null;
  private qrCode: string | null = null;
  private isConnected = false;
  private isRestarting = false;
  private isRunning = false;
  private qrLogged = false;
  /** Epoch en segundos del ultimo 'ready'. Corta el backlog al re-vincular. */
  private readyAt: number | null = null;
  /** true si en este ciclo de start() hubo QR, o sea vinculacion nueva. */
  private linkedViaQr = false;

  // start/stop/restart se serializan en esta cadena. Sin esto, dos reinicios
  // solapados dejan Chromiums huerfanos: fue exactamente lo que paso el 06/09,
  // con cinco clientes vivos emitiendo 'authenticated' al mismo tiempo.
  private opChain: Promise<unknown> = Promise.resolve();

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.opChain.then(fn, fn);
    this.opChain = run.catch(() => undefined);
    return run;
  }

  /**
   * Numeros de los CLIENTES con los que el bot tiene permitido hablar, tanto
   * para responderles como para escribirles. NO es la linea del bot: esa se
   * define escaneando el QR.
   *
   *   WHATSAPP_ALLOWED_NUMBERS=5493425661254,5491122334455
   *
   * Vacia o ausente => sin restriccion (produccion). Se comparan solo los
   * digitos, asi que da igual el formato con el que venga el JID.
   */
  private static isAllowed(from: string): boolean {
    const raw = process.env.WHATSAPP_ALLOWED_NUMBERS?.trim();
    if (!raw) return true;

    const sender = from.replace(/\D/g, '');
    return raw
      .split(',')
      .map((n) => n.replace(/\D/g, ''))
      .filter(Boolean)
      .some((allowed) => sender.endsWith(allowed) || allowed.endsWith(sender));
  }

  private createClient() {
    return new Client({
      authStrategy: new LocalAuth({ clientId: 'b2b2c-client' }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });
  }

  /**
   * Los handlers se atan a UN cliente concreto y chequean `client === this.client`
   * antes de tocar estado. Si un destroy() fallo y quedo un Chromium zombie vivo,
   * sus eventos se descartan en vez de pisar al cliente actual o contestar dos veces.
   */
  private registerHandlers(client: Client) {
    const isCurrent = () => client === this.client;

    client.on('qr', (qr) => {
      if (!isCurrent()) return;
      this.linkedViaQr = true;
      this.qrCode = qr;
      this.emit('qr', qr);

      // WhatsApp Web rota el QR cada ~20s, asi que este evento se dispara en
      // loop hasta que alguien escanea. Logueamos el primero a info y las
      // renovaciones a debug, si no el log se vuelve ilegible.
      if (!this.qrLogged) {
        this.qrLogged = true;
        logger.info('QR de WhatsApp generado. Escanealo desde Configuracion (se renueva cada ~20s).');
      } else {
        logger.debug('QR de WhatsApp renovado');
      }
    });

    client.on('ready', () => {
      if (!isCurrent()) return;
      this.readyAt = Math.floor(Date.now() / 1000);
      this.isConnected = true;
      this.qrCode = null;
      this.qrLogged = false;
      this.emit('ready');
      logger.info('Cliente de WhatsApp listo');
    });

    client.on('authenticated', () => {
      if (!isCurrent()) return;
      logger.info('WhatsApp autenticado');
    });

    client.on('disconnected', (reason) => {
      if (!isCurrent()) return;
      this.isConnected = false;
      this.isRunning = false;
      this.emit('disconnected', reason);
      logger.error(`WhatsApp se desconecto. Motivo: ${reason}`);
      const { sendTelegramAlert } = require('../utils/logger');
      sendTelegramAlert(
        `WhatsApp se ha desconectado. Motivo: ${reason}. Entra al admin panel para re-escanear el codigo QR.`,
        'whatsapp_disconnect'
      );
    });

    client.on('message', async (msg) => {
      if (!isCurrent()) return;

      // Nada de estados, grupos ni listas de difusion.
      if (msg.isStatus || msg.from.includes('@g.us') || msg.from.includes('@broadcast')) return;

      // Solo texto plano. Un sticker, una ubicacion o un mensaje que WhatsApp Web
      // todavia no pudo descifrar ("Esperando el mensaje") llegan con body vacio
      // y disparaban el saludo igual.
      if (msg.type !== 'chat') return;
      if (!msg.body || !msg.body.trim()) return;

      // FECHA DE EMISION. msg.timestamp es el epoch (en segundos) en que se envio
      // el mensaje, no en que lo recibimos nosotros: es justo lo que hace falta
      // para descartar el backlog que WhatsApp entrega al conectar.
      //
      // Dos regimenes, porque no es lo mismo vincular que reconectar:
      //
      //  - Vinculacion nueva (hubo QR): se descarta TODO lo anterior al 'ready'.
      //    Escanear no puede significar contestar conversaciones viejas.
      //  - Reconexion (sesion restaurada, sin QR): se acepta hasta maxAge hacia
      //    atras. Si el server estuvo caido dos minutos, el cliente que escribio
      //    en el medio merece respuesta; cortar contra el 'ready' lo dejaria
      //    hablando solo.
      const cutoff = this.linkedViaQr
        ? (this.readyAt ?? 0) - 5
        : Math.floor(Date.now() / 1000) - MAX_MESSAGE_AGE_SECONDS;

      if (msg.timestamp < cutoff) {
        const edad = Math.floor(Date.now() / 1000) - msg.timestamp;
        logger.info(
          `Mensaje descartado de ${msg.from}: emitido hace ${edad}s ` +
            `(${this.linkedViaQr ? 'backlog de vinculacion' : 'mas viejo que maxAge'})`
        );
        return;
      }

      // Allowlist opcional: mientras se testea sobre una linea real, evita que el
      // bot le conteste a contactos de verdad. Vacia = contesta a todos.
      if (!WhatsappService.isAllowed(msg.from)) {
        logger.info(`Mensaje ignorado de ${msg.from}: fuera de WHATSAPP_ALLOWED_NUMBERS`);
        return;
      }

      const config = await StoreConfig.findOne();
      if (!config || !config.isBotActive) {
        return;
      }

      const contact = await msg.getContact();
      const senderName = contact.pushname || contact.name || 'Cliente';

      const { handleIncomingMessage } = require('./chatbotService');
      await handleIncomingMessage(msg.from, msg.body, senderName);
    });
  }

  /**
   * Se llama una sola vez desde server.ts, DESPUES de connectDB().
   * Respeta el flag: si el bot esta desactivado, no se levanta Chromium.
   */
  public async bootstrap(): Promise<WhatsappActionResult> {
    if (!BOT_ENABLED) {
      logger.info('Bot de WhatsApp deshabilitado en este deployment (WHATSAPP_BOT_ENABLED != true). No se inicia nada.');
      return { success: false, reason: 'bot_disabled', message: 'Bot deshabilitado en el .env' };
    }

    const config = await StoreConfig.findOne();
    if (!config || !config.isBotActive) {
      logger.info('Bot de WhatsApp desactivado (isBotActive=false). No se inicia el cliente.');
      return { success: false, reason: 'bot_inactive', message: 'Bot desactivado' };
    }
    return this.start();
  }

  /**
   * Arranca el cliente. Sin `force` respeta isBotActive; con `force` arranca
   * igual, porque viene de una accion explicita del admin (boton de reconectar
   * en Configuracion), donde la intencion de ver el QR es inequivoca.
   */
  public start(options: { force?: boolean } = {}): Promise<WhatsappActionResult> {
    return this.enqueue(() => this.doStart(options));
  }

  private async doStart(options: { force?: boolean } = {}): Promise<WhatsappActionResult> {
    // El interruptor del .env gana sobre TODO, incluido `force`. El boton de
    // reconectar del admin es intencion explicita del operador, pero no puede
    // saltearse una decision de la instalacion.
    if (!BOT_ENABLED) {
      logger.warn('Se intento iniciar el bot pero WHATSAPP_BOT_ENABLED no esta en true');
      return { success: false, reason: 'bot_disabled', message: 'El bot esta deshabilitado en este deployment' };
    }

    // Nunca dejar un cliente anterior colgado: si hay uno, se cierra primero.
    if (this.client) {
      await this.doStop();
    }

    if (this.isRunning) {
      return { success: true, reason: 'already_running', message: 'El bot ya esta corriendo' };
    }

    if (!options.force) {
      const config = await StoreConfig.findOne();
      if (!config || !config.isBotActive) {
        return { success: false, reason: 'bot_inactive', message: 'El bot esta desactivado' };
      }
    }

    this.qrLogged = false;
    this.linkedViaQr = false;
    this.client = this.createClient();
    this.registerHandlers(this.client);
    this.isRunning = true;

    // No se await a proposito: initialize() tarda lo que tarda en levantar
    // Chromium y no queremos bloquear la request que dispara el arranque.
    this.client.initialize().catch((err: Error) => {
      this.isRunning = false;
      logger.error(`No se pudo inicializar el cliente de WhatsApp: ${err.message}`);
    });

    logger.info('Iniciando cliente de WhatsApp...');
    return { success: true, message: 'Bot iniciando' };
  }

  public stop(): Promise<WhatsappActionResult> {
    return this.enqueue(() => this.doStop());
  }

  private async doStop(): Promise<WhatsappActionResult> {
    const client = this.client;
    if (!client) {
      this.isRunning = false;
      return { success: true, message: 'El bot ya estaba detenido' };
    }

    // Soltamos la referencia ANTES de destruir: a partir de aca isCurrent() da
    // false y cualquier evento tardio de este cliente se descarta.
    this.client = null;
    client.removeAllListeners();

    try {
      await client.destroy();
    } catch (err: any) {
      logger.warn(`destroy() fallo (${err.message}), cierro el browser a mano`);
      try {
        await (client as any).pupBrowser?.close();
      } catch (err2: any) {
        logger.warn(`Tampoco se pudo cerrar el browser: ${err2.message}`);
      }
    }

    this.isRunning = false;
    this.isConnected = false;
    this.qrCode = null;
    this.qrLogged = false;
    this.emit('disconnected', 'stopped');
    logger.info('Cliente de WhatsApp detenido');
    return { success: true, message: 'Bot detenido' };
  }

  public async restartClient(): Promise<WhatsappActionResult> {
    if (this.isRestarting) {
      logger.warn('Ya hay un reinicio en curso');
      return { success: false, reason: 'restart_in_progress', message: 'Ya hay un reinicio en curso' };
    }

    this.isRestarting = true;
    logger.info('Reiniciando cliente de WhatsApp...');
    try {
      // Un solo item en la cola para stop+start: asi ningun otro start/stop
      // se cuela en el medio y deja dos clientes vivos.
      return await this.enqueue(async () => {
        await this.doStop();
        return this.doStart({ force: true });
      });
    } catch (err: any) {
      logger.error(`Fallo el reinicio del cliente de WhatsApp: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      // Antes esto se limpiaba en los handlers de qr/ready: si el cliente nunca
      // llegaba a ninguno de los dos, el flag quedaba en true para siempre y no
      // se podia reintentar sin reiniciar el server.
      this.isRestarting = false;
    }
  }

  public getQrCode() {
    return this.qrCode;
  }

  public getStatus() {
    return this.isConnected;
  }

  public getRunning() {
    return this.isRunning;
  }

  /** false = deshabilitado en el .env; ningun boton del admin lo va a levantar. */
  public getEnabled() {
    return BOT_ENABLED;
  }

  public async sendMessage(to: string, message: string) {
    if (!this.isConnected || !this.client) {
      throw new Error('WhatsApp is not connected');
    }

    // La allowlist tambien corta la salida. Si esta seteada estas testeando, y un
    // pedido de prueba con un telefono real no tiene por que terminar escribiendole
    // a un desconocido. No lanza: solo descarta y avisa, para no romper el flujo
    // del chatbot ni el de las notificaciones de pedido.
    if (!WhatsappService.isAllowed(to)) {
      logger.warn(`Envio bloqueado a ${to}: fuera de WHATSAPP_ALLOWED_NUMBERS`);
      return;
    }

    const jid = await this.resolveJid(to);
    await this.client.sendMessage(jid, message);
  }

  /**
   * Traduce un telefono al identificador real que usa WhatsApp.
   *
   * Armar `${numero}@c.us` a mano dejo de alcanzar: desde que WhatsApp
   * introdujo los LID (linked identity), ese id construido no siempre resuelve
   * a un contacto y el envio falla con "No LID for user" -- que es la tanda de
   * errores que quedo en error.log. getNumberId le pregunta a WhatsApp cual es
   * el id verdadero, y de paso responde si ese numero tiene WhatsApp.
   *
   * En Argentina esto importa el doble: el id real suele venir SIN el 9 aunque
   * uno mande el numero CON 9. Resolverlo a mano es adivinar.
   */
  private async resolveJid(to: string): Promise<string> {
    if (to.includes('@')) return to; // ya es un JID

    const parsed = normalizeArgentinePhone(to);
    const candidate = parsed?.e164 ?? to.replace(/\D/g, '');
    if (!candidate) {
      throw new Error(`Numero de telefono invalido: "${to}"`);
    }

    if (!parsed) {
      logger.warn(`No se pudo normalizar "${to}"; se intenta igual con ${candidate}`);
    }

    const resolved = await this.client!.getNumberId(candidate);
    if (!resolved) {
      throw new Error(`El numero ${candidate} no tiene WhatsApp`);
    }
    return resolved._serialized;
  }
}

export const whatsappService = new WhatsappService();
