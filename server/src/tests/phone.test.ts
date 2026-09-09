import { describe, it, expect } from 'vitest';
import { normalizeArgentinePhone, formatArgentinePhone } from '../utils/phone';

describe('normalizeArgentinePhone', () => {
  it('acepta el formato que ya viene bien', () => {
    expect(normalizeArgentinePhone('5493425661254')?.e164).toBe('5493425661254');
  });

  it('agrega el 54 y el 9 cuando falta el país', () => {
    expect(normalizeArgentinePhone('3425661254')?.e164).toBe('5493425661254');
  });

  it('saca el 0 de larga distancia', () => {
    expect(normalizeArgentinePhone('03425661254')?.e164).toBe('5493425661254');
  });

  it('saca el 15 después de un área de 3 dígitos', () => {
    expect(normalizeArgentinePhone('0342155661254')?.e164).toBe('5493425661254');
  });

  it('saca el 15 después de un área de 2 dígitos', () => {
    expect(normalizeArgentinePhone('011 15 1234 5678')?.e164).toBe('5491112345678');
  });

  it('saca el 15 después de un área de 4 dígitos', () => {
    // 2966 = Río Gallegos
    expect(normalizeArgentinePhone('02966 15 42 1234')?.e164).toBe('5492966421234');
  });

  it('tolera espacios, guiones, paréntesis y el +', () => {
    expect(normalizeArgentinePhone('+54 9 (342) 566-1254')?.e164).toBe('5493425661254');
    expect(normalizeArgentinePhone('(0342) 15-566-1254')?.e164).toBe('5493425661254');
  });

  it('acepta el 00 internacional', () => {
    expect(normalizeArgentinePhone('005493425661254')?.e164).toBe('5493425661254');
  });

  it('acepta el 54 sin el 9 de móvil', () => {
    expect(normalizeArgentinePhone('543425661254')?.e164).toBe('5493425661254');
  });

  it('devuelve el nacional de 10 dígitos', () => {
    expect(normalizeArgentinePhone('+5493425661254')?.national).toBe('3425661254');
  });

  it('rechaza en vez de inventar cuando no alcanzan los dígitos', () => {
    expect(normalizeArgentinePhone('5661254')).toBeNull();
    expect(normalizeArgentinePhone('342566')).toBeNull();
  });

  it('rechaza cuando sobran dígitos y no hay un 15 que explique el exceso', () => {
    expect(normalizeArgentinePhone('34256612549999')).toBeNull();
  });

  it('rechaza vacíos y basura', () => {
    expect(normalizeArgentinePhone('')).toBeNull();
    expect(normalizeArgentinePhone(null)).toBeNull();
    expect(normalizeArgentinePhone(undefined)).toBeNull();
    expect(normalizeArgentinePhone('no soy un teléfono')).toBeNull();
  });

  it('rechaza áreas que no existen en Argentina', () => {
    // Ningún código de área argentino arranca con 1 salvo el 11, ni con 4-9.
    expect(normalizeArgentinePhone('1234567890')).toBeNull();
    expect(normalizeArgentinePhone('9876543210')).toBeNull();
  });
});

describe('formatArgentinePhone', () => {
  it('formatea para mostrar', () => {
    expect(formatArgentinePhone('5493425661254')).toBe('342 566-1254');
    expect(formatArgentinePhone('5491112345678')).toBe('11 1234-5678');
  });

  it('devuelve el original cuando no puede normalizar, para no esconder el dato', () => {
    expect(formatArgentinePhone('123')).toBe('123');
  });
});
