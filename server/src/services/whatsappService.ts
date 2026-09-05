import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { EventEmitter } from 'events';

class WhatsappService extends EventEmitter {
  private client: Client;
  private qrCode: string | null = null;
  private isConnected: boolean = false;

  constructor() {
    super();
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'b2b2c-client' }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }
    });

    this.initialize();
  }

  private initialize() {
    this.client.on('qr', (qr) => {
      this.qrCode = qr;
      this.emit('qr', qr);
      console.log('QR Code received, scan please');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.qrCode = null;
      this.emit('ready');
      console.log('WhatsApp Client is ready!');
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Authenticated');
    });

    this.client.on('disconnected', (reason) => {
      this.isConnected = false;
      this.emit('disconnected', reason);
      console.log('WhatsApp Client was logged out', reason);
    });

    this.client.initialize();
  }

  public getQrCode() {
    return this.qrCode;
  }

  public getStatus() {
    return this.isConnected;
  }

  public async sendMessage(to: string, message: string) {
    if (!this.isConnected) {
      throw new Error('WhatsApp is not connected');
    }
    const formattedNumber = to.includes('@') ? to : `${to}@c.us`;
    await this.client.sendMessage(formattedNumber, message);
  }
}

export const whatsappService = new WhatsappService();
