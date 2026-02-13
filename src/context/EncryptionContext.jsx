import { createContext, useContext, useState } from "react";

const EncryptionContext = createContext(null);

export function EncryptionProvider({ children }) {
  const [privateKey, setPrivateKey] = useState(null);

  return (
    <EncryptionContext.Provider value={{ privateKey, setPrivateKey }}>
      {children}
    </EncryptionContext.Provider>
  );
}

// Custom hook (IMPORTANT)
export function useEncryption() {
  const ctx = useContext(EncryptionContext);
  if (!ctx) {
    throw new Error("useEncryption must be used inside EncryptionProvider");
  }
  return ctx;
}
