import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const submit = () => {
    sessionStorage.clear;
  }
  return (
    <>
      {/* ✅ Load Tailwind Elements (only once, ideally in index.html) */}

      {/* ✅ Navbar */}
      <nav className="relative bg-gray-800/50 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white/10">
          <div className="flex justify-around items-center px-2 pt-2 pb-2">
            <Link 
            to={"/home"}
            className="rounded-md flex justify-center bg-gray-950/50 px-3 py-2 text-base font-medium text-white hover:bg-gray-800"
            >
              Home
            </Link>
            <Link
              to={"/groups"}
              aria-current="page"
              className="rounded-md flex justify-center bg-gray-950/50 px-3 py-2 text-base font-medium text-white hover:bg-gray-800"
            >
              Groups
            </Link>
            <Link
              to={"/addcontact"}
              aria-current="page"
              className="rounded-md flex justify-center bg-gray-950/50 px-3 py-2 text-base font-medium text-white hover:bg-gray-800"
            >
              Add contact
            </Link>
            <Link
              to={"/"}
              onClick={submit}
              aria-current="page"
              className="rounded-md flex justify-center bg-gray-950/50 px-3 py-2 text-base font-medium text-white hover:bg-gray-800"
            >
              Log out
            </Link>
          </div>
      </nav>
    </>
  );
}
