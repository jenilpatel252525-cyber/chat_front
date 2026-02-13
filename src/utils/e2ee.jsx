// src/utils/e2ee.js
// Helpers: Base64 <-> bytes + RSA keypair generation + password-protected private-key backup
// Exports base64 helpers and the high-level backup functions.

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// -----------------------------
// RSA key generation & export
// -----------------------------
export async function generateRsaKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable (we need to export)
    ["encrypt", "decrypt"]
  );
  return keyPair;
}

export async function exportPublicKeyBase64(publicKey) {
  const spki = await window.crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(spki);
}

async function exportPrivateKeyJwkString(privateKey) {
  const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
  return JSON.stringify(jwk);
}

async function importPrivateKeyFromJwkString(jwkString) {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
}

// -----------------------------
// Password -> AES key (PBKDF2)
// -----------------------------
async function deriveAesKeyFromPassword(password, saltBytes) {
  const enc = new TextEncoder();

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return aesKey;
}

// -----------------------------
// Encrypt / Decrypt private key with password (AES-GCM)
// -----------------------------
export async function encryptPrivateKeyWithPassword(privateKey, password) {
  const enc = new TextEncoder();
  const jwkString = await exportPrivateKeyJwkString(privateKey);

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await deriveAesKeyFromPassword(password, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    enc.encode(jwkString)
  );

  const blob = {
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    cipher: arrayBufferToBase64(ciphertext),
  };

  return JSON.stringify(blob);
}

export async function decryptPrivateKeyWithPassword(encryptedBackupJson, password) {
  const dec = new TextDecoder();

  let blob;
  try {
    blob = JSON.parse(encryptedBackupJson);
  } catch (e) {
    console.error("Invalid encrypted backup JSON:", e);
    throw new Error("Invalid backup format");
  }

  const saltBytes = new Uint8Array(base64ToArrayBuffer(blob.salt));
  const ivBytes = new Uint8Array(base64ToArrayBuffer(blob.iv));
  const cipherBytes = new Uint8Array(base64ToArrayBuffer(blob.cipher));

  const aesKey = await deriveAesKeyFromPassword(password, saltBytes);

  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    aesKey,
    cipherBytes
  );

  const jwkString = dec.decode(plainBuffer);
  const privateKey = await importPrivateKeyFromJwkString(jwkString);
  return privateKey;
}

// -----------------------------
// High-level helpers
// -----------------------------
export async function createKeysAndEncryptedBackup(password) {
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const publicKeyBase64 = await exportPublicKeyBase64(publicKey);
  const encryptedBackup = await encryptPrivateKeyWithPassword(
    privateKey,
    password
  );

  return {
    publicKeyBase64,
    encryptedBackup,
    privateKey,
  };
}

// Export Base64 helpers for reuse
export { arrayBufferToBase64, base64ToArrayBuffer };
