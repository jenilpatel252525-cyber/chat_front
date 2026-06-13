import { useState, useEffect, useCallback } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";

export default function AddContact() {
  // const [contacts, setContacts] = useState([]);
  const [num, setNum] = useState("");
  const [profileId, setProfileId] = useState(null);
  // const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  const fetchContacts = useCallback(async () => {
    try {
      const res = await API.get("/userprofile/");
      console.log("UserProfile:", res.data);

      const userProfile = res.data[0];
      if (userProfile) {
        setProfileId(userProfile.id);
        // setContacts(userProfile.contacts || []);
      } else {
        // setContacts([]);
      }

      // const roomRes = await API.get("/rooms/");
      // const allRooms = roomRes.data.rooms || roomRes.data[0]?.rooms || roomRes.data || [];
      // console.log(allRooms);
      
      // const myPrivateChats = allRooms.filter((r) => !r.is_group);
      // setRooms(myPrivateChats);
    } catch (err) {
      console.error("Error fetching contacts:", err);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!num.trim()) {
      alert("Please enter a valid profile ID.");
      return;
    }

    try {
      // 1️⃣ Add contact
      const res=await API.post("/userprofile/add_contact/", { profile_id: num });
      console.log(res.data);

      if (res.data["message"]==="Already in contacts."){
        alert("Already in contacts.")
        return
      }
      

      // 2️⃣ Create a private room
      await API.post("/rooms/", {
        name: `chat_${profileId}_${num}`,
        is_group: false,
        participants_ids: [num],
      });

      await fetchContacts();
      setNum("");
      alert("contact added successfully")
    } catch (err) {
      alert("profile does not exists or already in contacts.")
      console.error("Error adding contact:", err);
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-center items-center h-screen gap-4">

      {/* ================= ADD CONTACT ================= */}
      <h1 className="text-xl font-semibold">Add New Contact</h1>
      <form
        onSubmit={onSubmit}
        className="flex flex-col justify-center shadow-2xl bg-gray-100 p-4 rounded-2xl w-80 gap-2"
      >
        <input
          value={num}
          onChange={(e) => setNum(e.target.value)}
          className="rounded-2xl p-2 border"
          type="text"
          placeholder="Enter contact Profile ID"
        />
        <button className="bg-blue-500 hover:bg-blue-800 text-white rounded-2xl p-2" type="submit">
          Add
        </button>
      </form>

      <button
        className="bg-blue-500 hover:bg-blue-800 text-white rounded-2xl px-4 py-2 mt-4"
        onClick={() => navigate("/home")}
      >
        Go to contacts
      </button>
    </div>
    </div>
  );
}
