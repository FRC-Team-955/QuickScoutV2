import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import { Bell, Search, User, LogOut, Menu } from "lucide-react";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import TopBar from "./Topbar";

const Index = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Update active tab based on current route
    if (location.pathname === "/scouting") {
      setActiveTab("scouting");
    } else if (location.pathname === "/dashboard") {
      setActiveTab("dashboard");
    } else if (location.pathname === "/analytics") {
      setActiveTab("analytics");
    } else if (location.pathname === "/matches") {
      setActiveTab("matches");
    } else if (location.pathname === "/leaderboard") {
      setActiveTab("leaderboard");
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "scouting") {
      navigate("/scouting");
    } else if (tab === "dashboard") {
      navigate("/dashboard");
    } else if (tab === "analytics") {
      navigate("/analytics");
    } else if (tab === "matches") {
      navigate("/matches");
    } else if (tab === "leaderboard") {
      navigate("/leaderboard");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <main
        className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <TopBar activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Page Content */}
        <div className="p-6">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "matches" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">
                Matches
              </h2>
              <p className="text-muted-foreground mt-2">
                Match schedule coming soon...
              </p>
            </div>
          )}
          {activeTab === "scouting" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">
                Scouting
              </h2>
              <p className="text-muted-foreground mt-2">
                Redirecting to scouting page...
              </p>
            </div>
          )}
          {activeTab === "analytics" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">
                Analytics
              </h2>
              <p className="text-muted-foreground mt-2">
                Advanced analytics coming soon...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
