import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./components/Index";
import Login from "./pages/Login";
import Scouting from "./pages/Scouting";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import Matches from "./pages/Matches";
import Leaderboard from "./pages/Leaderboard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

const RedirectHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      navigate(redirect, { replace: true });
    }
  }, [navigate]);

  return null;
};

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState(
    location.pathname === "/dashboard" ? "/dashboard" : location.pathname,
  );
  const lastPathRef = useRef(location.pathname);
  const suppressRootSyncRef = useRef(false);

  useEffect(() => {
    const path = location.pathname;

    if (path !== "/") {
      setCurrentView(path);
      suppressRootSyncRef.current = true;
      navigate("/", { replace: true });
    } else {
      if (suppressRootSyncRef.current) {
        suppressRootSyncRef.current = false;
      } else if (lastPathRef.current !== "/dashboard") {
        setCurrentView("/dashboard");
      }
    }

    lastPathRef.current = path;
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated && currentView === "/login") {
      setCurrentView("/dashboard");
    } else if (!isAuthenticated && currentView !== "/login") {
      setCurrentView("/login");
    }
  }, [currentView, isAuthenticated, loading]);

  const renderPage = () => {
    switch (currentView) {
      case "/login":
        return (
          <PublicRoute>
            <Login />
          </PublicRoute>
        );
      case "/dashboard":
        return (
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        );
      case "/scouting":
        return (
          <ProtectedRoute>
            <Scouting />
          </ProtectedRoute>
        );
      case "/analytics":
        return (
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        );
      case "/matches":
        return (
          <ProtectedRoute>
            <Matches />
          </ProtectedRoute>
        );
      case "/leaderboard":
        return (
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        );
      default:
        return <NotFound />;
    }
  };

  return (
    <>
      <RedirectHandler />
      {renderPage()}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter basename="/QuickScoutV2">
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
