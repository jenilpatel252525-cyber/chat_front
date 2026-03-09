import { useState, useEffect , useRef } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import {
  generateRoomKey,
  encryptRoomKeyForUser,
} from "./utils/groupCrypto";

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const navigate = useNavigate()
  const [profileId,setProfileId] = useState(0)
  const socketRef = useRef(null)
  const BACKEND =
  import.meta.env.VITE_API_URL ||
  "https://glaucous-trina-frivolously.ngrok-free.dev";
  const WS_ORIGIN =
  import.meta.env.VITE_WS_URL ||
  BACKEND.replace(/^https/, "wss").replace(/\/$/, "");


  // ✅ Fetch logged-in user's profile and contacts
  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await API.get("/userprofile/");
        console.log("UserProfile response:", res.data);

        const userProfile = res.data[0];
        if (userProfile) {
          // contacts are profiles (each has id + user.username)
          setContacts(userProfile.contacts || []);
          setProfileId(userProfile.id)
        } else {
          setContacts([]);
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
      }
    }
    fetchContacts();
  }, []);

  // ✅ Fetch groups (auto refresh when `refresh` toggles)

  async function fetchGroups() {
      try {
        const res = await API.get("/rooms/");
        console.log("Rooms response:", res.data);
        const allRooms = res.data.rooms || res.data || [];
        const myGroups = allRooms.filter((room) => room.is_group === true);
        setGroups(myGroups);
      } catch (err) {
        console.error("Error fetching groups:", err);
      }
    }

  useEffect(() => {
    fetchGroups();
  }, []);

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
    alert("done")
    await API.post(
      `/rooms/${room.id}/set-room-keys/`,
      { keys: keysPayload }
    );
  }
  else{
    alert("deny")
  }
}

  async function handleRemove(g){
    await API.delete(`/rooms/${g.id}/`)
    fetchGroups();
  }

  async function handleRemove1(g){
    const res=await API.post(`/rooms/${g.id}/remove_member/`,{
      participants_ids:[profileId]
    })
    console.log(res.data);
    console.log("here");
    
    await rotateAndDistributeRoomKey(res.data)
    fetchGroups();
  }

  useEffect(()=>{
    const token = sessionStorage.getItem("access") || "";
    const ws = new WebSocket(
      `${WS_ORIGIN}/ws/group/?token=${encodeURIComponent(
        token
      )}`
    );
    socketRef.current = ws;
    ws.onmessage = async(event) =>{
      const data = JSON.parse(event.data)
      console.log(data);
      
      if (data["type"]==="REFRESH_GROUPS"){
        fetchGroups()
      }
      if (data["type"]==="connected"){
        console.log(data["name"]);
      }
    }
    return () => {
      console.log("closed");
      
      ws.close();                // ✅ close ONLY in cleanup
      socketRef.current = null;
    }
  },[])

  return (
    <div className="flex flex-col h-screen">
      <Navbar/>
      <div className="flex flex-col justify-center items-center h-screen gap-4 p-4">
      {/* ================= GROUP LIST ================= */}
      <h1 className="text-2xl font-bold">My Groups</h1>
      <ul className="flex flex-col bg-gray-100 p-4 w-full gap-2">
        {groups.length > 0 ? (
          groups.map((g) => (
            <div className="flex flex-row">
              <li
              key={g.id}
              className="flex justify-between bg-green-400 w-2xl hover:bg-green-800 p-2"
            >
              <button
                className="text-white px-3 py-1 rounded-xl w-full text-center"
                onClick={() => navigate(`/chat/${g.id}/${true}`,{
                    state: {contacts,profileId}
                  })} // ✅ navigate with room id
              >
                {g.name}
              </button>
            </li>
            <button onClick={()=>g.admin.id===profileId ? handleRemove(g) : handleRemove1(g)} className="text-red-800 hover:underline px-3 py-1 rounded-xl">
                  remove
                </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center">No groups found.</p>
        )}
      </ul>

      {/* ================= NAVIGATE ================= */}
      <div className="space-x-1">
        <button
        className="bg-blue-500 hover:bg-blue-800 text-white rounded-2xl px-4 py-2 mt-4"
        onClick={() => navigate("/home")}
      >
        Go to Contacts
      </button>
      <button
        className="bg-blue-500 hover:bg-blue-800 text-white rounded-2xl px-4 py-2 mt-4"
        onClick={() => navigate("/creategroup")}
      >
        Create group
      </button>
      </div>
    </div>
    </div>
  );
}