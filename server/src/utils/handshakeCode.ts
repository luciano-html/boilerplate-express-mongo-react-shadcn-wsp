/**
 * Codigo corto para vincular un pedido de la web con el WhatsApp del cliente.
 *
 * Alfabeto sin 0/O/1/I/L: el cliente lo puede llegar a tipear a mano si edita
 * el mensaje prellenado, y confundir un cero con una O es garantia de soporte.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateHandshakeCode(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Encuentra un codigo dentro del texto libre que escribio el cliente. */
export function extractHandshakeCode(text: string): string | null {
  const match = text.toUpperCase().match(/#\s*([ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4})\b/);
  return match ? match[1] : null;
}
