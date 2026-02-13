// src/utils/groupCrypto.js
// AES room key helpers + message encryption/decryption + room-key <-> RSA helpers

import { arrayBufferToBase64, base64ToArrayBuffer } from "./e2ee";
import { importPublicKey, encryptWithPublicKey, decryptWithPrivateKey } from "./rsa";
/**
 * Generate a random AES-GCM 256-bit room key (CryptoKey)
 */

export async function generateRoomKey() {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  return key;
}

/**
 * Export AES room key as Base64 string (raw key bytes)
 */
export async function exportRoomKeyBase64(roomKey) {
  const raw = await window.crypto.subtle.exportKey("raw", roomKey);
  return arrayBufferToBase64(raw);
}

/**
 * Import AES room key from Base64 string
 */
export async function importRoomKeyFromBase64(base64) {
  const raw = base64ToArrayBuffer(base64);
  const key = await window.crypto.subtle.importKey(
    "raw",
    raw,
    {
      name: "AES-GCM",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return key;
}

/**
 * Encrypt a text message with AES-GCM room key.
 * Returns a JSON string containing iv + cipher, both Base64.
 */
export async function encryptMessageWithRoomKey(roomKey, plaintext) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    roomKey,
    enc.encode(plaintext)
  );

  const blob = {
    iv: arrayBufferToBase64(iv.buffer),
    cipher: arrayBufferToBase64(cipherBuffer),
  };

  return JSON.stringify(blob);
}

/**
 * Decrypt previously encrypted message (JSON with iv + cipher) using AES-GCM room key.
 */
export async function decryptMessageWithRoomKey(roomKey, encryptedJson) {
  const dec = new TextDecoder();

  let blob;
  try {
    blob = JSON.parse(encryptedJson);
  } catch (e) {
    console.error("Invalid encrypted message JSON:", e);
    return "[invalid cipher]";
  }

  try {
    const iv = new Uint8Array(base64ToArrayBuffer(blob.iv));
    const cipherBytes = new Uint8Array(base64ToArrayBuffer(blob.cipher));

    const plainBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      roomKey,
      cipherBytes
    );

    return dec.decode(plainBuffer);
  } catch (e) {
    console.error("Failed to decrypt group message:", e);
    return "[cannot decrypt]";
  }
}

/**
 * Given a roomKey (CryptoKey) and a recipient's public key (Base64 SPKI),
 * return encrypted_room_key (Base64 string) using RSA-OAEP.
 */
export async function encryptRoomKeyForUser(roomKey, recipientPublicKeyBase64) {
  const roomKeyBase64 = await exportRoomKeyBase64(roomKey);
  const pubKey = await importPublicKey(recipientPublicKeyBase64);
  const encrypted = await encryptWithPublicKey(pubKey, roomKeyBase64);
  return encrypted;
}

/**
 * Given encrypted_room_key (Base64 RSA cipher string) and our private key,
 * recover the AES room key CryptoKey.
 */
export async function decryptRoomKeyForCurrentUser(encryptedRoomKeyCipher,privateKey) {
  
  if (!privateKey) {
    console.warn("No privateChatKey in memory, cannot decrypt room key.");
    return null;
  }

  try {
    const roomKeyBase64 = await decryptWithPrivateKey(
      encryptedRoomKeyCipher,
      privateKey
    );
    const roomKey = await importRoomKeyFromBase64(roomKeyBase64);
    return roomKey;
  } catch (e) {
    console.error("Failed to decrypt room key:", e);
    return null;
  }
}
