import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Menu, User } from "lucide-react";

type TopBarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  topContent?: ReactNode;
  leftContent?: ReactNode;
};

const TopBar = ({ activeTab, onTabChange, topContent, leftContent }: TopBarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
      {topContent}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <Drawer>
              <DrawerTrigger>
                <button className="p-2" aria-label="Open navigation">
                  <Menu className="w-5 h-5" />
                </button>
              </DrawerTrigger>
              <DrawerContent>
                <MobileSidebarContent activeTab={activeTab} onTabChange={onTabChange} />
              </DrawerContent>
            </Drawer>
          </div>
          {leftContent ? (
            <div className="hidden md:block relative flex-1 max-w-md">
              {leftContent}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.name || "Scout"}</p>
              <p className="text-xs text-muted-foreground">Team {user?.teamNumber || 955}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
