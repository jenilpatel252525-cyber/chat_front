import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "./api";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ============================================================
  // Login handler
  // ============================================================
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/token/", {
        username: formData.username,
        password: formData.password,
      });

      sessionStorage.setItem("access", res.data.access);
      sessionStorage.setItem("refresh", res.data.refresh);

      navigate("/home");
    } catch (err) {
      console.error(err);
      setError("Invalid credentials.");
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
