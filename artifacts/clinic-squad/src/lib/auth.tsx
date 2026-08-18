import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "doctor" | "assistant" | "secretary" | "nurse" | "superadmin";
  clinicId?: string | null;
  name: string;
  specialty?: string | null;
  whatsappNumber?: string | null;
  isBlocked: boolean;
  emailVerifiedAt?: string | null;
}

export interface AuthClinic {
  id: string;
  requestNumber?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  ownerId: string;
  status: "pending" | "pending_approval" | "active" | "blocked" | "deactivated" | "deleted";
  subscriptionStatus: "trial" | "basic" | "premium" | "expired";
  trialEndDate: string;
  subscriptionPlan: string | null;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  clinic: AuthClinic | null;
  token: string | null;
}

interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AuthUser, clinic: AuthClinic | null, token: string) => void;
  logout: () => void;
  updateClinic: (clinic: AuthClinic) => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, clinic: null, token: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("clinicsquad_auth");
      if (stored) {
        const parsed = JSON.parse(stored) as AuthState;
        if (parsed.user && parsed.token) {
          setState(parsed);
          setAuthTokenGetter(() => parsed.token);
        }
      }
    } catch {
      localStorage.removeItem("clinicsquad_auth");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => state.token);
  }, [state.token]);

  const login = (user: AuthUser, clinic: AuthClinic | null, token: string) => {
    const newState = { user, clinic, token };
    // Register the token immediately. The login page redirects as soon as
    // this function returns, while the state effect runs after the next
    // render. Without this synchronous update, the first dashboard queries
    // can be sent without Authorization and return 401.
    setAuthTokenGetter(() => token);
    setState(newState);
    localStorage.setItem("clinicsquad_auth", JSON.stringify(newState));
  };

  const logout = () => {
    setState({ user: null, clinic: null, token: null });
    localStorage.removeItem("clinicsquad_auth");
  };

  const updateClinic = (clinic: AuthClinic) => {
    setState(prev => {
      const newState = { ...prev, clinic };
      localStorage.setItem("clinicsquad_auth", JSON.stringify(newState));
      return newState;
    });
  };

  const updateUser = (user: AuthUser) => {
    setState(prev => {
      const newState = { ...prev, user };
      localStorage.setItem("clinicsquad_auth", JSON.stringify(newState));
      return newState;
    });
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      isAuthenticated: !!state.user && !!state.token,
      isLoading,
      login,
      logout,
      updateClinic,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
