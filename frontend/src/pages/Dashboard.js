import React, { useEffect, useState } from "react";
import { auth } from "../firebase";

function Dashboard() {
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUserEmail(currentUser.email);
    }
  }, []);

  return (
    <div className="container" style={{ padding: "20px" }}>
      <h2>Student Dashboard</h2>
      {userEmail && <p>Welcome, <strong>{userEmail}</strong>!</p>}
      <p>This is your dashboard where you can access assessments and other resources.</p>
    </div>
  );
}

export default Dashboard;
