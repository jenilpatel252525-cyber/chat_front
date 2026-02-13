import { useState } from "react";
import { decryptPrivateKeyWithPassword } from "./utils/e2ee";
import { useEncryption } from "./context/EncryptionContext";
import { useNavigate } from "react-router-dom";

export default function UnlockKeyModal({ encryptedBackup, onSuccess }) {
  const { setPrivateKey } = useEncryption();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate()

  const submit = () => {
    localStorage.clear()
    navigate("/")
  }

  async function handleUnlock(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const privateKey = await decryptPrivateKeyWithPassword(
        encryptedBackup,
        password
      );

      setPrivateKey(privateKey);
      setPassword("");
      onSuccess();
    } catch {
      setError("Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex flex-col gap-3 items-center justify-center">
      <form
        onSubmit={handleUnlock}
        className="bg-white p-6 rounded-2xl w-80 flex flex-col gap-3"
      >
        <h2 className="font-bold text-center">Unlock Chats</h2>

        <input
          type="password"
          required
          placeholder="Encryption password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-800 text-white py-2 rounded-xl"
        >
          {loading ? "Unlocking…" : "Unlock"}
        </button>
      </form>
      <button
          onClick={submit}
          className="bg-blue-500 hover:bg-blue-800 w-80 text-white py-2 rounded-xl border"
        >
          Log out
      </button>
    </div>
  );
}
