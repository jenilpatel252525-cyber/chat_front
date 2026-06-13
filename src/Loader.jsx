import Navbar from "./Navbar";

export default function Loader(){
    return (
        <div className="flex flex-col h-screen">
            
            <Navbar />

            <div className="flex flex-1 justify-center items-center">
                <div className="border-4 border-blue-500 border-t-transparent rounded-full w-10 h-10 animate-spin"></div>
            </div>

        </div>
    )
}