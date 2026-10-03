import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import TopBar from "./Topbar";

// Only rendered for the "/dashboard" view; other tabs are separate pages routed by App.
const Index = () => {
    const navigate = useNavigate();
    const handleTabChange = (tab: string) => navigate(`/${tab}`);

    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab="dashboard" onTabChange={handleTabChange}/>

            {/* Main Content */}
            <main
                className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
                style={{WebkitOverflowScrolling: "touch"}}
            >
                <TopBar activeTab="dashboard" onTabChange={handleTabChange}/>

                {/* Page Content */}
                <div className="p-6">
                    <Dashboard/>
                </div>
            </main>
        </div>
    );
};

export default Index;
