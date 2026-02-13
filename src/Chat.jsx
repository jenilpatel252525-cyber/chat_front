// src/Chat.jsx
import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import API from "./api";
import Navbar from "./Navbar";

import {
  decryptWithPrivateKey,
  importPublicKey,
  encryptWithPublicKey,
} from "./utils/rsa";

import {
  decryptRoomKeyForCurrentUser,
  encryptMessageWithRoomKey,
  decryptMessageWithRoomKey,
  generateRoomKey,
  encryptRoomKeyForUser,
} from "./utils/groupCrypto";

import { useEncryption } from "./context/EncryptionContext";

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
  const use = location.state?.profileId || null
  const navigate = useNavigate();

  const messagesEndRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  const keysReadyRef = useRef(false);
  const adminRef = useRef("")

  const { privateKey } = useEncryption();

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
  const roomKeyVersionRef = useRef(null);
  const roomKeysRef = useRef({});
  const pendingOutgoingRef = useRef([]);


  // ---------------------------
  // Group keys
  // ---------------------------

  // ---------------------------
  // 1-1 helpers
  // ---------------------------
  const [otherUserProfile, setOtherUserProfile] = useState(null);
  const [recipientPublicKey, setRecipientPublicKey] = useState(null);
  const [name, setName] = useState("");

  // ---------------------------
  // Selection (admin add/remove)
  // ---------------------------
  const [selected, setSelected] = useState([]);
  // ---------------------------
  // Guard: private key
  // ---------------------------
  useEffect(() => {
    if (!privateKey) {
      alert("Please unlock your encryption key first");
      navigate("/home");
    }
  }, []);

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
  if (!user || !privateKey) return;

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
  
  roomKeyVersionRef.current=room.key_version

  setParticipants(
    room.participants.filter((p) => p.id !== room.admin.id)
  );

  const other = room.participants.find((p) => p.id !== user.id);
  setOtherUserProfile(other || null);
  setName(other?.user?.username || "");

  setRemain(
    contacts.filter(
      (c) => !room.participants.some((p) => p.id === c.id)
    )
  );

  // 3️⃣ Load & decrypt room keys FIRST
  let keyMap = {};
  if (isGroupBool) {
    const rkRes = await API.get(`/room-keys/?room_id=${room.id}`);

    for (const rk of rkRes.data) {
      try {
        const key = await decryptRoomKeyForCurrentUser(
          rk.encrypted_room_key,
          privateKey
        );
        if (key) keyMap[rk.version] = key;
      } catch {
        // user not allowed for this version → skip
      }
    }

    roomKeysRef.current = keyMap;
    keysReadyRef.current = true;
  }

  // 4️⃣ Decrypt messages ONLY if key exists
  const decrypted = await Promise.all(
    msgs.map(async (m) => {
      try {
        // ---------- GROUP ----------
        if (isGroupBool) {
          const key = keyMap[m.key_version];
          if (!key) return null; // 🚫 no key → hide message

          return {
            ...m,
            text: await decryptMessageWithRoomKey(
              key,
              m.encrypted_text
            ),
          };
        }

        // ---------- 1-1 ----------
        const isSender = m.user?.id === user.id;
        const ciphertext = isSender
          ? m.encrypted_for_sender
          : m.encrypted_for_receiver;

        if (!ciphertext) return null;

        return {
          ...m,
          text: await decryptWithPrivateKey(
            ciphertext,
            privateKey
          ),
        };
      } catch {
        return null; // decrypt failed → hide
      }
    })
  );

  // 5️⃣ Filter undecryptable messages (correct UX)
  setMessages(decrypted.filter(Boolean));

}, [roomId, contacts, isGroupBool, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  async function fetchRoomKeys() {
    let keyMap = {};
    if (isGroupBool) {
      const rkRes = await API.get(`/room-keys/?room_id=${roomId}`);

      for (const rk of rkRes.data) {
        try {
          const key = await decryptRoomKeyForCurrentUser(
           rk.encrypted_room_key,
           privateKey
          );
          if (key) keyMap[rk.version] = key;
        } catch {
          // user not allowed for this version → skip
        }
      }

      roomKeysRef.current=keyMap
      keysReadyRef.current = true;

      const pending = [...pendingMessagesRef.current];
      pendingMessagesRef.current = [];

      for (const msg of pending) {
        await tryDecryptAndAppend(msg);
      }

      for (const text of pendingOutgoingRef.current) {
        const key = roomKeysRef.current[roomKeyVersionRef.current];
        const encrypted = await encryptMessageWithRoomKey(key, text);
        socketRef.current.send(JSON.stringify({ encrypted_text: encrypted }));
      }
      pendingOutgoingRef.current = [];
    }
  }

  async function tryDecryptAndAppend(msg, keyMapOverride = null) {
  const keyMap = keyMapOverride || roomKeysRef.current;

  if (msg.key_version < roomKeyVersionRef.current){
    return
  }

  // 🔐 version guard
  if (roomKeyVersionRef.current === null || msg.key_version > roomKeyVersionRef.current) {
    pendingMessagesRef.current.push(msg);
    console.log(roomKeyVersionRef.current);
    alert("back1")
    return;
  }

  const key = keyMap[msg.key_version];
  if (!key) {
    alert("no key")
    // removed member OR no access
    return;
  }

  const text = await decryptMessageWithRoomKey(
    key,
    msg.encrypted_text
  );

  console.log(messages);
  
  setMessages(prev => [
    ...prev,
    {
      id: msg.id,
      text,
      user: { username: msg.user },
      timestamp: msg.timestamp,
    },
  ]);

  console.log(messages);
  
}

  // ============================================================
  // Fetch recipient public key (1-1)
  // ============================================================
  useEffect(() => {
    if (isGroupBool || !otherUserProfile) return;

    API.get(
      `/encryption-keys/?user_id=${otherUserProfile.user.id}`
    ).then(async (res) => {
      if (res.data[0]?.public_key) {
        setRecipientPublicKey(
          await importPublicKey(res.data[0].public_key)
        );
      }
    });
  }, [isGroupBool, otherUserProfile]);

  // ============================================================
  // WebSocket
  // ============================================================
  useEffect(() => {
    if (!user || !privateKey){
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
        alert("you are not a member of this group now")
        return
      }

      if (data["type"] === "room.key_rotated") {
        roomKeyVersionRef.current=data["version"];
        keysReadyRef.current = false;

        await fetchRoomKeys(); 
        await fetchMessages()// reload keys + messages

      }
      
      if (data["type"] === "chat_message") {
        // alert("here3")
    try {
      // alert("here2")
      let text = "[cannot decrypt]";

      // ---------- GROUP ----------
      if (isGroupBool) {
        if (!keysReadyRef.current) {
          pendingMessagesRef.current.push(data);
          alert(
            "back"
          )
          return;
        }
        if (data["key_version"] < roomKeyVersionRef.current){
          return
        }
        await tryDecryptAndAppend(data);
        return
      }

      // ---------- 1-1 ----------
      else {
        // alert("here1")
        const isSender = data["user_id"] === use;
        console.log({
          wsUser: data["user_id"],
          stateUser: use,
          isSender,
        });

        const ciphertext = isSender
          ? data.encrypted_for_sender
          : data.encrypted_for_receiver;

        if (ciphertext) {
          // alert("ciphertext")
          console.log(privateKey);
          
          text = await decryptWithPrivateKey(
            ciphertext,
            privateKey
          );
        }
        setMessages((prev) => [
        ...prev,
        {
          id: data["id"],
          text,
          user: { username: data["user"] },
          timestamp: data.timestamp,
        },
      ]);
      }
      
    } catch (e) {
      console.error("WS decrypt failed:", e);
    }
  }
}

  return () => {
    ws.close();                // ✅ close ONLY in cleanup
    socketRef.current = null;
  }
  }, [roomId, isGroupBool,user,privateKey]);

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
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !privateKey) {
      alert("Contact has removed you.")
      navigate("/home")
    };

    // -------- 1-1 --------
    if (!isGroupBool) {
      if (!recipientPublicKey) return;

      const encForReceiver = await encryptWithPublicKey(
        recipientPublicKey,
        newMsg
      );

      const encForSender = await encryptWithPublicKey(
        await importPublicKey(
          (await API.get("/encryption-keys/")).data[0].public_key
        ),
        newMsg
      );

      socketRef.current.send(
        JSON.stringify({
          encrypted_for_sender: encForSender,
          encrypted_for_receiver: encForReceiver,
        })
      );
    }

    // -------- GROUP --------
    else {
      //start
      const key = roomKeysRef.current[roomKeyVersionRef.current]
      if (!key) {
        pendingOutgoingRef.current.push(newMsg);
        return
      }
      const encrypted = await encryptMessageWithRoomKey(
        key,
        newMsg
      );

      socketRef.current.send(
        JSON.stringify({
          encrypted_text: encrypted,
        })
      );
    }

    setNewMsg("");
  };

  // ============================================================
  // UI
  // ============================================================



//here it is




  async function rotateAndDistributeRoomKey(room) {
  const newRoomKey = await generateRoomKey();
  const keysPayload = [];

  for (const p of room.participants) {
    try {
      const res = await API.get(
        `/encryption-keys/?user_id=${p.user.id}`
      );

      const pubKey = res.data[0]?.public_key;
      if (!pubKey) continue;

      const encryptedRoomKey = await encryptRoomKeyForUser(
        newRoomKey,
        pubKey
      );

      keysPayload.push({
        user_profile_id: p.id,
        encrypted_room_key: encryptedRoomKey,
      });
    } catch (e) {
      console.error("Key encrypt failed for", p.user.username, e);
    }
  }

  if (keysPayload.length > 0) {
    await API.post(
      `/rooms/${room.id}/set-room-keys/`,
      { keys: keysPayload }
    );
  }
}

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
  const res=await API.post(`/rooms/${roomId}/add_member/`, {
    participants_ids: selected,
  });

  // 2️⃣ fetch updated room
  // const roomRes = await API.get(`/rooms/${roomId}/`);
  // const room = roomRes.data;

  // 3️⃣ distribute new room key
  await rotateAndDistributeRoomKey(res.data);

  setSelected([]);
  fetchMessages();
};

const handleRemove = async () => {
  if (!selected.length) return;

  // 1️⃣ remove members (backend rotates key_version)
  const res=await API.post(`/rooms/${roomId}/remove_member/`, {
    participants_ids: selected,
  });

  // 2️⃣ fetch updated room
  // const roomRes = await API.get(`/rooms/${roomId}/`);
  // const room = roomRes.data;

  // 3️⃣ distribute new room key
  await rotateAndDistributeRoomKey(res.data);

  setSelected([]);
  fetchMessages();
};

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
