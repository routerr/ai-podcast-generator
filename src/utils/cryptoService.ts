const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

export const cryptoService = {
  async encrypt(plaintext: string, password: string): Promise<EncryptedData> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const passwordEncoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordEncoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      passwordEncoder.encode(plaintext)
    );

    return {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv.buffer),
      salt: arrayBufferToBase64(salt.buffer)
    };
  },

  async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
    const salt = new Uint8Array(base64ToArrayBuffer(encryptedData.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
    const encrypted = base64ToArrayBuffer(encryptedData.encrypted);

    const passwordEncoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordEncoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }
};
