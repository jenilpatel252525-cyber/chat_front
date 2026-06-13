// src/CreateGroup.jsx
import { useState, useEffect } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";

export default function CreateGroups() {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const navigate = useNavigate();

  // --------------------------------------------------
  // Fetch logged-in user's profile and contacts
  // --------------------------------------------------
  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await API.get("/userprofile/");
        const userProfile = res.data[0];
        setContacts(userProfile?.contacts || []);
      } catch (err) {
        console.error("Error fetching contacts:", err);
      }
    }
    fetchContacts();
  }, []);

  // --------------------------------------------------
  // Toggle contact selection
  // --------------------------------------------------
  function handleSelect(profileId) {
    setSelected((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  }

  // --------------------------------------------------
  // Create new group
  // --------------------------------------------------
  async function onSubmit(e) {
  e.preventDefault();

  if (!name.trim()) {
    alert("Please enter a group name.");
    return;
  }

  if (selected.length === 0) {
    alert("Please select at least one contact.");
    return;
  }

  try {
    const res = await API.post("/rooms/", {
      name: name.trim(),
      is_group: true,
      participants_ids: selected,
    });

    const room = res.data;
    const roomId = room.id;

    alert("Group created successfully");

    setName("");
    setSelected([]);

    navigate(`/chat/${roomId}/true`, {
      state: { contacts },
    });
  } catch (err) {
    console.error("Error creating group:", err);
    alert("Failed to create group.");
  }
}

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="h-screen">
      <Navbar />
      <div className="flex flex-col justify-center items-center gap-4 p-4">
        <h1 className="text-2xl font-bold">My Contacts</h1>

        <ul className="flex flex-col bg-gray-100 rounded-2xl p-4 w-80 gap-2">
          {contacts.length > 0 ? (
            contacts.map((c) => (
              <li
                key={c.id}
                className="flex justify-between bg-blue-400 hover:bg-blue-800 rounded-2xl p-2"
              >
                <button
                  className={`text-white px-3 py-1 rounded-xl w-full ${
                    selected.includes(c.id)
                      ? "bg-blue-700"
                      : "bg-blue-500"
                  }`}
                  onClick={() => handleSelect(c.id)}
                >
                  {c.user?.username || "Unknown"}
                </button>
              </li>
            ))
          ) : (
            <p className="text-gray-500 text-center">
              No contacts found.
            </p>
          )}
        </ul>

        <h1 className="text-xl font-semibold">Add New Group</h1>

        <form
          onSubmit={onSubmit}
          className="flex flex-col shadow-2xl bg-gray-100 p-4 rounded-2xl w-80 gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl p-2 border"
            placeholder="Enter group name"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-800 text-white rounded-2xl p-2"
          >
            Create Group
          </button>
        </form>

        <button
          className="bg-blue-500 hover:bg-blue-800 text-white rounded-2xl px-4 py-2 mt-4"
          onClick={() => navigate("/groups")}
        >
          Go to groups
        </button>
      </div>
    </div>
  );
}
