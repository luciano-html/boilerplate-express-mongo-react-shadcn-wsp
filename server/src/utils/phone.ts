/**
 * Normalización de teléfonos argentinos al formato que espera WhatsApp.
 *
 * WhatsApp identifica a un móvil argentino como `549` + área + abonado, sin el
 * 0 de larga distancia y sin el 15. Pero la gente lo escribe de siete formas
 * distintas y ninguna es esa:
 *
 *   342 566 1254        →  5493425661254
 *   0342 15 566 1254    →  5493425661254
 *   (0342) 15-5661254   →  5493425661254
 *   +54 9 342 5661254   →  5493425661254
 *   +54 342 5661254     →  5493425661254
 *   11 1234 5678        →  5491112345678
 *
 * Mandar el número mal no falla ruidosamente: WhatsApp responde que ese
 * contacto no existe, el .catch loguea y el cliente simplemente nunca recibe
 * nada. Por eso esto tiene tests: es un lugar donde se pierde plata en silencio.
 */

/** Códigos de área argentinos de 2 dígitos (el resto son de 3 o 4). */
const AREA_2 = ['11'];

export interface NormalizedPhone {
  /** Formato WhatsApp: 549XXXXXXXXXX. */
  e164: string;
  /** Área + abonado, 10 dígitos, sin 54/9/0/15. */
  national: string;
}

/**
 * Devuelve null cuando el número no puede interpretarse como un móvil
 * argentino. Preferimos null antes que un número inventado: un envío a un
 * número equivocado es peor que un envío que no sale.
 */
export function normalizeArgentinePhone(raw: string | undefined | null): NormalizedPhone | null {
  if (!raw) return null;

  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // Prefijo internacional escrito como 00.
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Código de país.
  if (digits.startsWith('54')) {
    digits = digits.slice(2);
    // El 9 de móvil, si vino.
    if (digits.startsWith('9')) digits = digits.slice(1);
  }

  // 0 de larga distancia nacional.
  if (digits.startsWith('0')) digits = digits.slice(1);

  // El 15 va después del código de área y solo en llamadas locales. Como los
  // códigos de área tienen 2, 3 o 4 dígitos, se prueba sacarlo en cada posición
  // posible y se acepta la que deje un nacional de 10 dígitos.
  if (digits.length > 10) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === '15') {
        const candidate = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        if (candidate.length === 10) {
          digits = candidate;
          break;
        }
      }
    }
  }

  // Un móvil argentino son 10 dígitos: área + abonado.
  if (digits.length !== 10) return null;

  // Los de 2 dígitos son solo el 11; el resto arranca con 2 o 3.
  const startsOk = AREA_2.includes(digits.slice(0, 2)) || /^[23]/.test(digits);
  if (!startsOk) return null;

  return { e164: `549${digits}`, national: digits };
}

/**
 * Igual que la anterior pero para mostrar: 342 566-1254.
 * Si no se puede normalizar, devuelve lo que vino, para no esconder el dato.
 */
export function formatArgentinePhone(raw: string | undefined | null): string {
  const parsed = normalizeArgentinePhone(raw);
  if (!parsed) return raw ?? '';

  const { national } = parsed;
  const areaLength = AREA_2.includes(national.slice(0, 2)) ? 2 : national.length === 10 ? 3 : 4;
  const area = national.slice(0, areaLength);
  const rest = national.slice(areaLength);
  return `${area} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}
