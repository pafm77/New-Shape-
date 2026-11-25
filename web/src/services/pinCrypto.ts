const PIN_HASH_PREFIX = 'pbkdf2_sha256';
const PIN_PBKDF2_ITERATIONS = 50_000;
const PIN_SALT_PREFIX = 'newshape-pin:';

export function isValidFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function normalizePinInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2Hex(
  pin: string,
  saltHex: string,
  iterations: number
): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('O browser não suporta encriptação segura de PIN neste endereço.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`${PIN_SALT_PREFIX}${saltHex}`),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derived));
}

/**
 * Generates a salted PBKDF2-HMAC-SHA256 hash compatible with Android's StudentPinHasher.
 * Format: pbkdf2_sha256$<iterations>$<saltHex>$<hashHex>
 */
export async function hashStudentPin(pin: string): Promise<string> {
  if (!isValidFourDigitPin(pin)) {
    throw new Error('O PIN tem de ter exatamente 4 dígitos numéricos.');
  }
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const saltHex = bytesToHex(saltBytes);
  const hashHex = await derivePbkdf2Hex(pin, saltHex, PIN_PBKDF2_ITERATIONS);
  return `${PIN_HASH_PREFIX}$${PIN_PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

export async function verifyStudentPin(pin: string, storedHash: string): Promise<boolean> {
  if (!isValidFourDigitPin(pin) || !storedHash) return false;
  const parts = storedHash.trim().split('$');
  if (parts.length !== 4) return false;
  const [algo, iterStr, saltHex, expectedHex] = parts;
  if (algo !== PIN_HASH_PREFIX) return false;
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 200_000) {
    return false;
  }
  if (!/^[0-9a-f]{16,64}$/i.test(saltHex) || !/^[0-9a-f]{64}$/i.test(expectedHex)) {
    return false;
  }
  const computedHex = await derivePbkdf2Hex(pin, saltHex.toLowerCase(), iterations);
  return constantTimeEqual(computedHex, expectedHex.toLowerCase());
}
