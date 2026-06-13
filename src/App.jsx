import { BrowserRouter, Routes, Route } from "react-router-dom";

import Register from "./Register";
import Login from "./Login";
import Home from "./Home";
import Groups from "./Groups";
import Chat from "./Chat";
import AddContact from "./AddContact";
import CreateGroups from "./CreateGroup";
import Loader from "./Loader";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/creategroup" element={<CreateGroups />} />
        <Route path="/addcontact" element={<AddContact />} />
        <Route path="/chat/:roomId/:isGroup" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  );
}
