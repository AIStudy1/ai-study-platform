import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const { session, user: userData } = data;
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(session.access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const getRole = (u) => {
    if (!u) return null;
    return u.role || u.user_metadata?.role || null;
  };

  const role = getRole(user);
  const isAdmin = role === "admin";
  const isStudent = role === "student";

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isStudent, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
