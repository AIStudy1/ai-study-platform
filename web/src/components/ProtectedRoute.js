import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requiredRole }) {
  const { token, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0d1117",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#6ee7f7", fontFamily: "sans-serif", fontSize: 14,
      }}>
        Loading...
      </div>
    );
  }

  // Not logged in
  if (!token) return <Navigate to="/login" replace />;

  // Logged in but wrong role
  if (requiredRole && role !== requiredRole) {
    if (role === "admin") return <Navigate to="/dashboard" replace />;
    if (role === "student") return <Navigate to="/mobile" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
