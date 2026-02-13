// Register.jsx
import { useState } from "react";
import API from "./api";
import { useNavigate } from "react-router";

export default function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const navigate=useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault(); // ✅ Prevent page reload
    try {
      const res = await API.post("/register/", formData); // ✅ added trailing slash (Django expects it)
      console.log("Registration success:", res.data);
      alert("User registered successfully!");
      navigate("/")
    } catch (error) {
      console.error("Error registering user:", error.response?.data || error.message);
      alert("Registration failed!");
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 bg-gray-100 p-6 rounded-lg shadow-md w-80"
      >
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
          type="email"
          placeholder="Enter email"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
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
          className="bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
