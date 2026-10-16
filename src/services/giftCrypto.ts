import nacl from 'tweetnacl';
import * as Crypto from 'expo-crypto';

/* =========================================================================
 * Regalo cifrado: el libro viaja en un archivo que sólo se abre con un
 * código secreto. Sin el código, el archivo (que puede reenviarse, quedar en
 * un chat o en un correo) no deja ver ni una foto ni una palabra.
 *
 * - El código son 12 caracteres sin ambigüedades (sin I, L, O, 0, 1): ~59 bits.
 * - La clave sale del código y una sal aleatoria con SHA-512 iterado: cada
 *   intento de adivinarlo cuesta miles de hashes.
 * - El contenido va cifrado y autenticado (XSalsa20-Poly1305, tweetnacl): un
 *   código equivocado o un archivo manipulado simplemente no abre.
 *
 * No hace falta servidor. Si algún día se sube el archivo a uno para abrirlo
 * sólo con el código, el servidor guardaría este mismo texto cifrado.
 * ========================================================================= */

// tweetnacl no encuentra generador aleatorio en React Native: se le da el del sistema
nacl.setPRNG((out: Uint8Array, n: number) => {
  out.set(Crypto.getRandomBytes(n));
});

export const GIFT_KIND = 'our-memories-gift';
const GIFT_VERSION = 1;
const KDF_ITERATIONS = 12000;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

export interface GiftEnvelope {
  kind: typeof GIFT_KIND;
  version: number;
  kdf: { alg: 'sha512-iter'; iterations: number; salt: string };
  nonce: string;
  box: string;
}

/** Código nuevo con formato XXXX-XXXX-XXXX. */
export const generateGiftCode = (): string => {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of Crypto.getRandomBytes(32)) {
      // Se descartan los valores que sesgarían el reparto
      if (byte < 248 && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return formatGiftCode(code);
};

/** El código se acepta en minúsculas y con o sin guiones o espacios. */
export const normalizeGiftCode = (input: string) => input.toUpperCase().replace(/[\s-]+/g, '');

export const formatGiftCode = (raw: string) => {
  const clean = raw.replace(/[\s-]+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
};

export const isCompleteGiftCode = (input: string) => normalizeGiftCode(input).length === CODE_LENGTH;

/* ---------------------------- Clave del código ---------------------------- */

const deriveKey = (code: string, salt: Uint8Array, iterations: number) => {
  const codeBytes = utf8Encode(normalizeGiftCode(code));
  let h = nacl.hash(concat(salt, codeBytes));
  for (let i = 1; i < iterations; i++) h = nacl.hash(concat(h, salt));
  return h.subarray(0, nacl.secretbox.keyLength);
};

/* ------------------------------ Cifrar / abrir ------------------------------ */

export const encryptGift = (plainText: string, code: string): GiftEnvelope => {
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = deriveKey(code, salt, KDF_ITERATIONS);
  const box = nacl.secretbox(utf8Encode(plainText), nonce, key);
  return {
    kind: GIFT_KIND,
    version: GIFT_VERSION,
    kdf: { alg: 'sha512-iter', iterations: KDF_ITERATIONS, salt: base64Encode(salt) },
    nonce: base64Encode(nonce),
    box: base64Encode(box),
  };
};

export const isGiftEnvelope = (value: any): value is GiftEnvelope =>
  value?.kind === GIFT_KIND &&
  typeof value.box === 'string' &&
  typeof value.nonce === 'string' &&
  typeof value.kdf?.salt === 'string';

/** Devuelve el texto original, o null si el código no es el correcto. */
export const decryptGift = (envelope: GiftEnvelope, code: string): string | null => {
  try {
    const iterations = Math.min(200000, Math.max(1, Number(envelope.kdf.iterations) || KDF_ITERATIONS));
    const key = deriveKey(code, base64Decode(envelope.kdf.salt), iterations);
    const opened = nacl.secretbox.open(base64Decode(envelope.box), base64Decode(envelope.nonce), key);
    return opened ? utf8Decode(opened) : null;
  } catch {
    return null;
  }
};

/* ------------------------- Utilidades de bytes ------------------------- */
// Implementadas aquí: atob/btoa/TextDecoder no están garantizados en todos los motores JS

const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
};

const utf8Encode = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length * 3);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out[n++] = c;
    else if (c < 0x800) {
      out[n++] = 0xc0 | (c >> 6);
      out[n++] = 0x80 | (c & 63);
    } else if (c < 0x10000) {
      out[n++] = 0xe0 | (c >> 12);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    } else {
      out[n++] = 0xf0 | (c >> 18);
      out[n++] = 0x80 | ((c >> 12) & 63);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    }
  }
  return out.subarray(0, n);
};

const utf8Decode = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  let chunk: number[] = [];
  const flush = () => {
    parts.push(String.fromCharCode.apply(null, chunk));
    chunk = [];
  };
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) {
      c = b;
      i += 1;
    } else if (b < 0xe0) {
      c = ((b & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (b < 0xf0) {
      c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else {
      c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
      i += 4;
    }
    if (c >= 0x10000) {
      c -= 0x10000;
      chunk.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
    } else chunk.push(c);
    if (chunk.length >= 8192) flush();
  }
  flush();
  return parts.join('');
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

const base64Encode = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  let chunk: number[] = [];
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    chunk.push(
      B64.charCodeAt(n >> 18),
      B64.charCodeAt((n >> 12) & 63),
      B64.charCodeAt((n >> 6) & 63),
      B64.charCodeAt(n & 63)
    );
    if (chunk.length >= 8192) {
      parts.push(String.fromCharCode.apply(null, chunk));
      chunk = [];
    }
  }
  const rest = bytes.length - i;
  if (rest > 0) {
    const n = (bytes[i] << 16) | (rest === 2 ? bytes[i + 1] << 8 : 0);
    chunk.push(B64.charCodeAt(n >> 18), B64.charCodeAt((n >> 12) & 63));
    chunk.push(rest === 2 ? B64.charCodeAt((n >> 6) & 63) : 61, 61);
  }
  parts.push(String.fromCharCode.apply(null, chunk));
  return parts.join('');
};

const base64Decode = (text: string): Uint8Array => {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  let i = 0;
  for (; i + 3 < clean.length; i += 4) {
    const v =
      (B64_LOOKUP[clean.charCodeAt(i)] << 18) |
      (B64_LOOKUP[clean.charCodeAt(i + 1)] << 12) |
      (B64_LOOKUP[clean.charCodeAt(i + 2)] << 6) |
      B64_LOOKUP[clean.charCodeAt(i + 3)];
    out[n++] = v >> 16;
    out[n++] = (v >> 8) & 255;
    out[n++] = v & 255;
  }
  const rest = clean.length - i;
  if (rest >= 2) {
    const v = (B64_LOOKUP[clean.charCodeAt(i)] << 18) | (B64_LOOKUP[clean.charCodeAt(i + 1)] << 12) |
      (rest === 3 ? B64_LOOKUP[clean.charCodeAt(i + 2)] << 6 : 0);
    out[n++] = v >> 16;
    if (rest === 3) out[n++] = (v >> 8) & 255;
  }
  return out.subarray(0, n);
};
