import {Toaster} from "@/components/ui/toaster";
import {Toaster as Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {BrowserRouter, Navigate, useLocation, useNavigate} from "react-router-dom";
import {ComponentType, useEffect, useRef, useState} from "react";
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
import OPR from "./pages/OPR";
import {toast} from "sonner";

const queryClient = new QueryClient();

const protectedPages: Record<string, ComponentType> = {
    "/dashboard": Index,
    "/scouting": Scouting,
    "/pit-scouting": PitScouting,
    "/analytics": Analytics,
    "/matches": Matches,
    "/leaderboard": Leaderboard,
    "/opr": OPR,
};

const COMMITS_URL = "https://api.github.com/repos/FRC-Team-955/QuickScoutV2/commits/main";

const RedirectHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const redirect = new URLSearchParams(window.location.search).get("redirect");
        // "//host" would be a cross-origin pushState and throw
        if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
            navigate(redirect, {replace: true});
        }
    }, [navigate]);

    return null;
};

// Polls GitHub for new commits on main and nags the user to reload once main moves.
const useUpdateNag = () => {
    useEffect(() => {
        let baselineSha: string | null = null;
        let pausedUntil = 0;
        let stopped = false;
        let nagInterval: ReturnType<typeof setInterval> | undefined;

        const checkForUpdates = async () => {
            // Unauthenticated GitHub API allows 60 req/hr per IP, shared by every device on the venue network.
            if (stopped || nagInterval || document.hidden || Date.now() < pausedUntil) return;
            try {
                const response = await fetch(COMMITS_URL, {headers: {Accept: "application/vnd.github+json"}});
                if (!response.ok) {
                    // 403/429 when rate limited: back off until the reset time (or 10 min)
                    const reset = Number(response.headers.get("x-ratelimit-reset"));
                    pausedUntil = reset ? reset * 1000 : Date.now() + 600000;
                    return;
                }
                const sha = (await response.json())?.sha;
                if (stopped || typeof sha !== "string") return;
                baselineSha ??= sha;
                if (sha !== baselineSha) {
                    const showAlert = () => toast("Update available. Please reload the page.");
                    showAlert();
                    nagInterval = setInterval(showAlert, 10000);
                }
            } catch (err) {
                console.warn("Update check failed", err);
            }
        };

        checkForUpdates();
        const pollInterval = setInterval(checkForUpdates, 60000);
        return () => {
            clearInterval(pollInterval);
            clearInterval(nagInterval);
            stopped = true;
        };
    }, []);
};

const AppContent = () => {
    const {isAuthenticated, loading, user} = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState(location.pathname);
    const lastPathRef = useRef(location.pathname);
    const suppressRootSyncRef = useRef(false);
    const isPitDisplay = user?.role === 'pitDisplay';

    useUpdateNag();

    useEffect(() => {
        const path = location.pathname;

        // PitDisplay users can only access pit-display
        if (isPitDisplay) {
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
        } else if (suppressRootSyncRef.current) {
            suppressRootSyncRef.current = false;
        } else if (lastPathRef.current !== "/dashboard") {
            setCurrentView("/dashboard");
        }

        lastPathRef.current = path;
    }, [location.pathname, navigate, isPitDisplay]);

    useEffect(() => {
        if (loading) return;

        if (isAuthenticated && currentView === "/login") {
            setCurrentView("/dashboard");
        } else if (!isAuthenticated && currentView !== "/login" && currentView !== "/pit-display") {
            setCurrentView("/login");
        }
    }, [currentView, isAuthenticated, loading]);

    const renderPage = () => {
        // PitDisplay users can only see the pit display page
        if (isPitDisplay || currentView === "/pit-display") return <PitDisplay/>;
        // Wait for auth so a deep link isn't bounced to /login (and then /dashboard) before the session restores
        if (loading) return null;
        if (currentView === "/login") return isAuthenticated ? <Navigate to="/dashboard" replace/> : <Login/>;
        const Page = protectedPages[currentView];
        if (!Page) return <NotFound/>;
        return isAuthenticated ? <Page/> : <Navigate to="/login" replace/>;
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
