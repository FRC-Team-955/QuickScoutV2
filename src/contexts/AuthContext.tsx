import { createContext, useContext, useState, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  teamNumber: number;
}

interface AuthContextType {
  user: User | null;
  login: (name: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("frc-scout-user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = (name: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      name,
      teamNumber: 955,
    };
    setUser(newUser);
    localStorage.setItem("frc-scout-user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("frc-scout-user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
