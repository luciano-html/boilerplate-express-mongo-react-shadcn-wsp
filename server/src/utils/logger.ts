import winston from 'winston';
import NodeCache from 'node-cache';
import path from 'path';

// Cache to handle rate-limiting for Telegram alerts (10 minutes TTL)
const alertCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const logger = winston.createLogger({
  // LOG_LEVEL=debug para ver, entre otras cosas, las renovaciones del QR.
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/combined.log') })
  ]
});

// If we're not in production then log to the `console`
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export const sendTelegramAlert = async (message: string, alertType: string) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_DEV_CHAT_ID;

  if (!token || !chatId) {
    logger.warn(`Cannot send Telegram alert. Missing tokens. Message: ${message}`);
    return;
  }

  if (alertCache.has(alertType)) {
    logger.info(`[RateLimited] Telegram alert suppressed for: ${alertType}`);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ *B2B2C Alert*\n\n${message}`,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error(`Failed to send Telegram alert: ${err}`);
    } else {
      alertCache.set(alertType, true);
    }
  } catch (error: any) {
    logger.error(`Error sending Telegram alert: ${error.message}`);
  }
};

export default logger;
