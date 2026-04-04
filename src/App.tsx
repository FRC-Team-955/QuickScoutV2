import {Toaster} from "@/components/ui/toaster";
import {Toaster as Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {BrowserRouter, Navigate, useLocation, useNavigate} from "react-router-dom";
import {useEffect, useRef, useState} from "react";
import {AuthProvider, useAuth} from "@/contexts/AuthContext";
import Index from "./components/Index";
import Login from "./pages/Login";
import Scouting from "./pages/Scouting";
import PitScouting from "./pages/PitScouting";
import PitDisplay from "./pages/PitDisplay";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import Matches from "./pages/Matches";
import Leaderboard from "./pages/Leaderboard";
import {toast} from "sonner";

const queryClient = new QueryClient();

const ProtectedRoute = ({children}: { children: React.ReactNode }) => {
    const {isAuthenticated} = useAuth();
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace/>;
};

const PublicRoute = ({children}: { children: React.ReactNode }) => {
    const {isAuthenticated} = useAuth();
    return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace/>;
};

const RedirectHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        if (redirect) {
            navigate(redirect, {replace: true});
        }
    }, [navigate]);

    return null;
};

const AppContent = () => {
    const {isAuthenticated, loading, user} = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState(
        location.pathname === "/dashboard" ? "/dashboard" : location.pathname,
    );
    const lastPathRef = useRef(location.pathname);
    const suppressRootSyncRef = useRef(false);
    const latestShaRef = useRef<string | null>(null);
    const updateDetectedRef = useRef(false);
    const updateAlertIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Force pitDisplay user to pit-display page
    useEffect(() => {
        if (user?.role === 'pitDisplay' && location.pathname !== "/pit-display") {
            navigate("/pit-display", {replace: true});
        }
    }, [user?.role, location.pathname, navigate]);

    useEffect(() => {
        const path = location.pathname;

        // PitDisplay users can only access pit-display
        if (user?.role === 'pitDisplay') {
            setCurrentView("/pit-display");
            if (path !== "/pit-display") {
                navigate("/pit-display", {replace: true});
            }
            return;
        }

        if (path !== "/") {
            setCurrentView(path);
            suppressRootSyncRef.current = true;
            navigate("/", {replace: true});
        } else {
            if (suppressRootSyncRef.current) {
                suppressRootSyncRef.current = false;
            } else if (lastPathRef.current !== "/dashboard") {
                setCurrentView("/dashboard");
            }
        }

        lastPathRef.current = path;
    }, [location.pathname, navigate, user?.role]);

    useEffect(() => {
        if (loading) return;

        if (isAuthenticated && currentView === "/login") {
            setCurrentView("/dashboard");
        } else if (!isAuthenticated && currentView !== "/login" && currentView !== "/pit-display") {
            setCurrentView("/login");
        }
    }, [currentView, isAuthenticated, loading]);

    useEffect(() => {
        let isMounted = true;

        const fetchLatestSha = async () => {
            try {
                const response = await fetch(
                    "https://api.github.com/repos/FRC-Team-955/QuickScoutV2/commits/main",
                    {
                        headers: {
                            Accept: "application/vnd.github+json",
                        },
                    },
                );
                if (!response.ok) return null;
                const data = await response.json();
                return typeof data?.sha === "string" ? data.sha : null;
            } catch (err) {
                console.warn("Update check failed", err);
                return null;
            }
        };

        const triggerUpdateSpam = () => {
            if (updateDetectedRef.current) return;
            updateDetectedRef.current = true;
            const showAlert = () => {
                toast("Update available. Please reload the page.");
            };
            showAlert();
            updateAlertIntervalRef.current = setInterval(showAlert, 10000);
        };

        const checkForUpdates = async () => {
            const latestSha = await fetchLatestSha();
            if (!isMounted || !latestSha) return;

            if (!latestShaRef.current) {
                latestShaRef.current = latestSha;
                return;
            }

            if (latestShaRef.current !== latestSha) {
                triggerUpdateSpam();
            }
        };

        checkForUpdates();
        const intervalId = setInterval(checkForUpdates, 60000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            if (updateAlertIntervalRef.current) {
                clearInterval(updateAlertIntervalRef.current);
                updateAlertIntervalRef.current = null;
            }
        };
    }, []);

    const renderPage = () => {
        // PitDisplay users can only see the pit display page
        if (user?.role === 'pitDisplay') {
            return <PitDisplay/>;
        }

        switch (currentView) {
            case "/login":
                return (
                    <PublicRoute>
                        <Login/>
                    </PublicRoute>
                );
            case "/dashboard":
                return (
                    <ProtectedRoute>
                        <Index/>
                    </ProtectedRoute>
                );
            case "/scouting":
                return (
                    <ProtectedRoute>
                        <Scouting/>
                    </ProtectedRoute>
                );
            case "/pit-scouting":
                return (
                    <ProtectedRoute>
                        <PitScouting/>
                    </ProtectedRoute>
                );
            case "/pit-display":
                return <PitDisplay/>;
            case "/analytics":
                return (
                    <ProtectedRoute>
                        <Analytics/>
                    </ProtectedRoute>
                );
            case "/matches":
                return (
                    <ProtectedRoute>
                        <Matches/>
                    </ProtectedRoute>
                );
            case "/leaderboard":
                return (
                    <ProtectedRoute>
                        <Leaderboard/>
                    </ProtectedRoute>
                );
            default:
                return <NotFound/>;
        }
    };

    return (
        <>
            <RedirectHandler/>
            {renderPage()}
        </>
    );
};

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster/>
            <Sonner/>
            <AuthProvider>
                <BrowserRouter basename="/QuickScoutV2">
                    <AppContent/>
                </BrowserRouter>
            </AuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;
