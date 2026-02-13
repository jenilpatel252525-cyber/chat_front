// src/utils/rsa.js
// Centralized RSA helpers (importPublicKey, encryptWithPublicKey, decryptWithPrivateKey)

import { base64ToArrayBuffer } from "./e2ee";

/**
 * Import a public key from Base64 SPKI string
 */
export async function importPublicKey(base64) {
  const arrayBuffer = base64ToArrayBuffer(base64);
  return await window.crypto.subtle.importKey(
    "spki",
    arrayBuffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

/**
 * RSA encrypt - accepts a CryptoKey publicKey and a string message,
 * returns Base64 ciphertext
 */
// src/utils/rsa.js

/**
 * ArrayBuffer → Base64URL
 */
function arrayBufferToBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Base64URL → ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";

  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

export async function encryptWithPublicKey(publicKey, message) {
  const encoded = new TextEncoder().encode(message);

  const cipher = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoded
  );

  // ✅ Base64URL (WS safe)
  return arrayBufferToBase64Url(cipher);
}

export async function decryptWithPrivateKey(ciphertext, privateKey) {
  const arrayBuffer = base64UrlToArrayBuffer(ciphertext);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    arrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}