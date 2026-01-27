import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import { Bell, Search, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Index = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Update active tab based on current route
    if (location.pathname === "/scouting") {
      setActiveTab("scouting");
    } else if (location.pathname === "/") {
      setActiveTab("dashboard");
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
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search teams, matches, data..."
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{user?.name || "Scout"}</p>
                  <p className="text-xs text-muted-foreground">Team {user?.teamNumber || 955}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "teams" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">Teams</h2>
              <p className="text-muted-foreground mt-2">Team management coming soon...</p>
            </div>
          )}
          {activeTab === "matches" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">Matches</h2>
              <p className="text-muted-foreground mt-2">Match schedule coming soon...</p>
            </div>
          )}
          {activeTab === "scouting" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">Scouting</h2>
              <p className="text-muted-foreground mt-2">Redirecting to scouting page...</p>
            </div>
          )}
          {activeTab === "analytics" && (
            <div className="stat-card">
              <h2 className="font-mono font-bold text-foreground text-xl">Analytics</h2>
              <p className="text-muted-foreground mt-2">Advanced analytics coming soon...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
