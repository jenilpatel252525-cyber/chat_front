// src/Chat.jsx
import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import API from "./api";
import Navbar from "./Navbar";
import Loader from "./Loader";

const BACKEND =
  import.meta.env.VITE_API_URL ||
  "https://glaucous-trina-frivolously.ngrok-free.dev";

const WS_ORIGIN =
  import.meta.env.VITE_WS_URL ||
  BACKEND.replace(/^https/, "wss").replace(/\/$/, "");

export default function Chat() {
  const { roomId, isGroup } = useParams();
  const isGroupBool = isGroup === "true";

  const location = useLocation();
  const contacts = location.state?.contacts || [];
  const navigate = useNavigate();

  const messagesEndRef = useRef(null);
  const adminRef = useRef("")

  // ---------------------------
  // Core state
  // ---------------------------
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const socketRef = useRef(null);

  // ---------------------------
  // Room state
  // ---------------------------
  const [rname, setRname] = useState("");
  const [admin, setAdmin] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [remain, setRemain] = useState([]);

  // ---------------------------
  // Group keys
  // ---------------------------

  // ---------------------------
  // 1-1 helpers
  // ---------------------------
  const [name, setName] = useState("");

  // ---------------------------
  // Selection (admin add/remove)
  // ---------------------------
  const [selected, setSelected] = useState([]);
  const [loading,setLoading]=useState(false)
  // ---------------------------
  // Guard: private key
  // ---------------------------

  // ============================================================
  // Fetch logged-in user profile
  // ============================================================
  useEffect(() => {
    API.get("/userprofile/").then((res) => {
      setUser(res.data[0]);
    });
  }, []);

  // ============================================================
  // Fetch room + messages
  // ============================================================
  const fetchMessages = useCallback(async () => {
  if (!user) return;
  
  setLoading(true)

  // 1️⃣ Fetch room + messages
  const [msgRes, roomRes] = await Promise.all([
    API.get(`/messages/?room_id=${roomId}`),
    API.get(`/rooms/${roomId}/`),
  ]);

  const room = roomRes.data;
  const msgs = msgRes.data;

  // 2️⃣ Set room metadata
  setRname(room.name);
  setAdmin(room.admin);
  adminRef.current = room.admin.user.username
  console.log(room.admin.user.username);

  setParticipants(
    room.participants.filter((p) => p.id !== room.admin.id)
  );

  const other = room.participants.find((p) => p.id !== user.id);
  setName(other?.user?.username || "");

  setRemain(
    contacts.filter(
      (c) => !room.participants.some((p) => p.id === c.id)
    )
  );

  // 5️⃣ Filter undecryptable messages (correct UX)
  setMessages(msgs);
  setLoading(false)

}, [roomId, contacts, isGroupBool, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ============================================================
  // WebSocket
  // ============================================================
  useEffect(() => {
    if (!user){
      return
    };

    const token = sessionStorage.getItem("access") || "";
    const ws = new WebSocket(
      `${WS_ORIGIN}/ws/chat/${roomId}/?token=${encodeURIComponent(
        token
      )}`
    );

    socketRef.current = ws;

    ws.onmessage = async (event) => {

      const data = JSON.parse(event.data);
      console.log(data);

      if (data["type"] === "removed"){
          alert("You are not a member of this group now")
          setTimeout(() => navigate("/groups"), 100)
          return
      }

      if (data["type"] === "deleted"){
          alert("The group was deleted by the admin")
          setTimeout(() => navigate("/groups"), 100)
          return
      }

      if (data["type"] === "REFRESH_MEMBERS"){
        fetchMessages()
        return
      }
      
      if (data.type === "chat_message") {
        setMessages((prev) => [
          ...prev,
          {
            id: data.id,
            text: data.text,
            user: { username: data.user },
            timestamp: data.timestamp,
          },
        ]);
      }
    }

  return () => {
    ws.close();                // ✅ close ONLY in cleanup
    socketRef.current = null;
  }
  }, [roomId, isGroupBool,user]);

  // ============================================================
  // Auto-scroll
  // ============================================================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ============================================================
  // Send message
  // ============================================================
  const sendMessage = async (e) => {
    e.preventDefault();

    if (
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN
    ) {
      alert("Contact has removed you.");
      navigate("/home");
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        text: newMsg,
      })
    );

    setNewMsg("");
  };

  // ============================================================
  // UI
  // ============================================================

const handleSelected = (p) => {
  setSelected((prev) =>
    prev.includes(p.id)
      ? prev.filter((id) => id !== p.id)
      : [...prev, p.id]
  );
};

const handleAdd = async () => {
  if (!selected.length) return;

  // 1️⃣ add members (backend rotates key_version)
  await API.post(`/rooms/${roomId}/add_member/`, {
    participants_ids: selected,
  });

  setSelected([]);
  fetchMessages();
};

const handleRemove = async () => {
  if (!selected.length) return;

  // 1️⃣ remove members (backend rotates key_version)
  await API.post(`/rooms/${roomId}/remove_member/`, {
    participants_ids: selected,
  });

  setSelected([]);
  fetchMessages();
};

  if (loading){
    return (
      <Loader></Loader>
    )
  }
  else{
    return (
    <div className="h-screen">
      <Navbar />
      <div className="flex flex-col items-center p-4 bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">
          {isGroupBool ? rname : name}
        </h1>

        <div className="w-80 bg-gray-100 rounded-2xl p-4 h-96 overflow-y-auto mb-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-2">
              <b>{msg.user?.username}:</b> {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="flex w-80 gap-2">
          <input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            className="flex-1 p-2 border rounded-2xl"
          />
          <button className="bg-blue-500 hover:bg-blue-800 text-white px-4 rounded-2xl">
            Send
          </button>
        </form>
      
      {/* ADMIN CONTROLS */}
{isGroupBool && admin?.id === user?.id && (
  <div className="flex flex-col items-center w-80 mt-4 bg-gray-100 p-4 rounded-2xl">
    
    {/* ADD MEMBERS */}
    <h3 className="font-bold">Add Members</h3>

    {remain.length === 0 ? (
      <p className="text-gray-500 text-sm mt-2">No users available to add</p>
    ) : (
      <>
        {remain.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelected(c)}
            className="block text-green-500 hover:underline hover:text-green-800"
          >
            {selected.includes(c.id) ? "✅ " : ""}
            {c.user.username}
          </button>
        ))}

        <button
          onClick={handleAdd}
          className="mt-2 px-3 bg-green-500 text-white rounded-lg hover:bg-green-800"
        >
          Add
        </button>
      </>
    )}

    {/* REMOVE MEMBERS */}
    <h3 className="font-bold mt-4">Remove Members</h3>

    {participants.length === 0 ? (
      <p className="text-gray-500 text-sm mt-2">No members to remove</p>
    ) : (
      <>
        {participants.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelected(p)}
            className="block text-red-500 hover:underline hover:text-red-800"
          >
            {selected.includes(p.id) ? "❌ " : ""}
            {p.user.username}
          </button>
        ))}

        <button
          onClick={handleRemove}
          className="mt-2 px-3 bg-red-500 text-white rounded-lg hover:bg-red-800"
        >
          Remove
        </button>
      </>
    )}

  </div>
)}
{
  isGroupBool && admin?.id !== user?.id && (
    <div className="flex flex-col items-center w-80 mt-4 bg-gray-100 p-4 rounded-2xl">
      <h2 className="text-2xl underline">Members</h2>
      <p>admin: {adminRef.current}({admin?.id})</p>
      {participants.map((p) => (
            <p>{p.user.username}({p.id})</p>
        ))}
    </div>
  )
}
</div>
    </div>
  );
}

  }