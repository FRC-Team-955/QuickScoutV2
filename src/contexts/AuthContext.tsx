import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isLeadEmail } from "@/lib/lead-users";
import { setUserPresence, clearUserPresence, removeUserCompletely, leaveQueue, setSuppressPresenceOnUnload, shouldSuppressPresenceOnUnload, removeUserLastActive } from "@/lib/queue";

interface User {
  id: string;
  name: string;
  teamNumber: number;
  email?: string;
  isLead: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const name =
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0]||
          "User";
        const formatName = 
          name.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
        const mappedUser: User = {
          id: firebaseUser.uid,
          name: formatName,
          email: firebaseUser.email || undefined,
          teamNumber: 955,
          isLead: isLeadEmail(firebaseUser.email || undefined),
        };
        setUser(mappedUser);
        setUserPresence(mappedUser).catch(console.error);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const handler = () => {
      // if we've explicitly suppressed unload-presence (for example during logout), skip writing
      if (shouldSuppressPresenceOnUnload()) return;
      if (user?.id) {
        // best-effort: mark offline on unload (do NOT create lastActive when we're intentionally removing the user)
        clearUserPresence(user.id).catch(console.error);
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const signed = cred.user || auth.currentUser;
      if (!signed) throw new Error("Login failed");

      const name =
        signed.displayName ||
        signed.email?.split("@")[0] ||
        "User";
      const formatName = 
          name.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

      const mapped: User = {
        id: signed.uid,
        name: formatName,
        email: signed.email || undefined,
        teamNumber: 955,
        isLead: isLeadEmail(signed.email || undefined),
      };
      setUser(mapped);
      await setUserPresence(mapped);
      return;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (user?.id) {
        // prevent the unload handler during explicit logout cleanup
        setSuppressPresenceOnUnload(true);

        try {
          await removeUserCompletely(user.id);
        } catch (err) {
          console.warn("removeUserCompletely failed on logout — attempting targeted cleanup", err);
          // Don't call clearUserPresence here (that writes lastActive). Instead try to
          // remove the lastActive field and any queue entries. These are best-effort.
          try {
            await removeUserLastActive(user.id);
          } catch (er) {
            console.debug("removeUserLastActive also failed", er);
          }
          try {
            await leaveQueue(user.id);
          } catch (er) {
            console.debug("leaveQueue failed during logout cleanup", er);
          }
        } finally {
          // small delay to reduce races where other presence writers might run
          await new Promise((r) => setTimeout(r, 50));
          setSuppressPresenceOnUnload(false);
        }
      }

      // sign out any authenticated user (anonymous or email)
      if (auth.currentUser) {
        await signOut(auth);
      }

      setUser(null);

    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
