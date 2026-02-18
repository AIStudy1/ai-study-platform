import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";

function ProtectedRoute({ children }) {
  // useAuthState gives us current user and loading state
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <p>Loading...</p>; // or a spinner
  }

  if (!user || !user.emailVerified) {
    // if not logged in or email not verified
    return <Navigate to="/login" />;
  }

  return children;
}

export default ProtectedRoute;
