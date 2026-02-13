import { useState, useEffect, useCallback } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import UnlockKeyModal from "./UnlockKeyModal";
import { useEncryption } from "./context/EncryptionContext";

export default function Home() {
  const BACKEND =
  import.meta.env.VITE_API_URL ||
  "https://glaucous-trina-frivolously.ngrok-free.dev";
  const WS_ORIGIN =
  import.meta.env.VITE_WS_URL ||
  BACKEND.replace(/^https/, "wss").replace(/\/$/, "");

  const [contacts, setContacts] = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();
  const { privateKey } = useEncryption();

  // 🔐 unlock flow
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [encryptedBackup, setEncryptedBackup] = useState(null);
  const [checkedKey, setCheckedKey] = useState(false);

  // =========================
  // STEP 1: KEY GATE
  // =========================
  useEffect(() => {
    async function checkPrivateKey() {
      if (privateKey) {
        setCheckedKey(true);
        return;
      }

      try {
        const res = await API.get("/encryption-keys/");
        const backup = res.data?.[0]?.encrypted_private_key_backup;

        if (backup) {
          setEncryptedBackup(backup);
          setNeedsUnlock(true);
        }
      } catch (err) {
        console.error("Failed to check encryption keys:", err);
      } finally {
        setCheckedKey(true);
      }
    }

    checkPrivateKey();
  }, []);

  // =========================
  // STEP 2: FETCH DATA
  // =========================
  const fetchContacts = useCallback(async () => {
    try {
      const res = await API.get("/userprofile/");
      const userProfile = res.data[0];

      if (userProfile) {
        setProfileId(userProfile.id);
        setContacts(userProfile.contacts || []);
      }

      const roomRes = await API.get("/rooms/");
      const allRooms =
        roomRes.data.rooms || roomRes.data[0]?.rooms || roomRes.data || [];

      setRooms(allRooms.filter((r) => !r.is_group));
    } catch (err) {
      console.error("Error fetching contacts:", err);
    }
  }, []);

  useEffect(() => {
    if (!needsUnlock && checkedKey) {
      fetchContacts();
    }
  }, [needsUnlock, checkedKey, fetchContacts]);

  async function handleRemove(roomId) {
    const roomRes = await API.get(`/rooms/${roomId}/`);
    const other = roomRes.data.participants.find(
      (p) => p.id !== profileId
    );

    if (!other) return;

    await API.post("/userprofile/remove_contact/", {
      profile_id: other.id,
    });

    await API.delete(`/rooms/${roomId}/`);
    fetchContacts();
  }

  useEffect(()=>{
    const token = sessionStorage.getItem("access") || "";
    const ws = new WebSocket(
      `${WS_ORIGIN}/ws/contact/?token=${encodeURIComponent(
        token
      )}`
    );
    ws.onmessage = async(event) =>{
      const data = JSON.parse(event.data)
      console.log(data);
      
      if (data["type"]==="REFRESH_CONTACTS"){
        fetchContacts()
      }
      if (data["type"]==="connected"){
        console.log(data["name"]);
      }
    }
    return () => {
      console.log("closed");
      
      ws.close();                // ✅ close ONLY in cleanup
    }
  },[])

  // =========================
  // BLOCK UNTIL UNLOCK
  // =========================
  if (!checkedKey) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading secure session…</p>
      </div>
    );
  }

  if (needsUnlock && encryptedBackup) {
    return (
      <UnlockKeyModal
        encryptedBackup={encryptedBackup}
        onSuccess={() => setNeedsUnlock(false)}
      />
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex justify-center items-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold">
            My Contacts (Profile {profileId})
          </h1>

          <ul className="flex flex-col bg-gray-100 rounded-2xl p-4 w-80 gap-2">
            {rooms.length ? (
              rooms.map((room) => {
                const otherUser =
                  room.participants?.find((p) => p.id !== profileId);

                return (
                  <div key={room.id} className="flex">
                    <li className="flex-1 bg-green-400 rounded-2xl p-2 hover:bg-green-700">
                      <button
                        onClick={() =>
                          navigate(`/chat/${room.id}/false`, {
                            state: { contacts,profileId },
                          })
                        }
                        className="text-white w-full"
                      >
                        {otherUser?.user.username || "Unknown"}
                      </button>
                    </li>
                    <button
                      onClick={() => handleRemove(room.id)}
                      className="text-red-700 px-2 hover:underline"
                    >
                      remove
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-center">No chats found.</p>
            )}
          </ul>

          <div className="flex gap-2">
            <button
              className="bg-blue-500 hover:bg-blue-800 text-white px-4 py-2 rounded-xl"
              onClick={() => navigate("/groups")}
            >
              Groups
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-800 text-white px-4 py-2 rounded-xl"
              onClick={() => navigate("/addcontact")}
            >
              Add Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
