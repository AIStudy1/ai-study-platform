import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MobileRedirect from "./pages/MobileRedirect";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const { token, isAdmin, isStudent, loading } = useAuth();

  if (loading) return null; // wait for auth to hydrate

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Admin only */}
      <Route path="/dashboard" element={
        <ProtectedRoute requiredRole="admin">
          <Dashboard />
        </ProtectedRoute>
      } />

      {/* Student redirect */}
      <Route path="/mobile" element={
        <ProtectedRoute requiredRole="student">
          <MobileRedirect />
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
