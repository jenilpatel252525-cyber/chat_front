import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "./api";
import { useEncryption } from "./context/EncryptionContext";

import {
  createKeysAndEncryptedBackup,
} from "./utils/e2ee";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const {setPrivateKey} = useEncryption()

  // ============================================================
  // 🔐 Ensure RSA encryption keys exist for this user
  // ============================================================
  async function ensureEncryptionKeys() {
    // Check if keys already exist
    const res = await API.get("/encryption-keys/");
    if (res.data && res.data.length > 0) {
      return; // already set up
    }

    // First-time setup
    const password = window.prompt(
      "Create an encryption password (used to protect your private chat key).\n\n⚠️ Do NOT forget this password."
    );

    if (!password) {
      alert("Encryption password is required to continue.");
      throw new Error("Encryption setup cancelled");
    }

    const {
      publicKeyBase64,
      encryptedBackup,
      privateKey,
    } = await createKeysAndEncryptedBackup(password);

    // Store public key + encrypted private key backup
    await API.post("/encryption-keys/", {
      public_key: publicKeyBase64,
      encrypted_private_key_backup: encryptedBackup,
    });

    // 🔐 Keep private key ONLY in memory
    setPrivateKey(privateKey);
  }

  // ============================================================
  // Login handler
  // ============================================================
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1️⃣ Get JWT tokens
      const res = await API.post("/token/", {
        username: formData.username,
        password: formData.password,
      });

      // 2️⃣ Save tokens
      sessionStorage.setItem("access", res.data.access);
      sessionStorage.setItem("refresh", res.data.refresh);

      // 3️⃣ Ensure encryption keys exist
      await ensureEncryptionKeys();

      // 4️⃣ Go to home
      navigate("/home");
    } catch (err) {
      console.error(err);
      setError("Invalid credentials or encryption setup failed.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 bg-gray-100 p-6 rounded-lg shadow-md w-80"
      >
        <h2 className="text-center text-lg font-bold">Login</h2>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          type="text"
          required
          placeholder="Enter username"
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value })
          }
          className="border p-2 rounded"
        />

        <input
          required
          type="password"
          placeholder="Enter password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          className="border p-2 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Submit"}
        </button>

        <div>
          <p>
            haven't registered yet? get registered here.{" "}
            <Link className="text-blue-800 underline" to="/register">
              register
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
