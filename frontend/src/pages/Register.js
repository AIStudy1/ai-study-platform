import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import validator from "validator";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return setError("All fields required");
    if (!validator.isEmail(email)) return setError("Invalid email");
    if (password.length < 6) return setError("Password too short");

    try {
      await api.post("/auth/register", { name, email, password });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", borderRadius: "10px", boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Create Account</h2>
      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "10px", margin: "10px 0", borderRadius: "5px" }}/>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: "10px", margin: "10px 0", borderRadius: "5px" }}/>
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "10px", margin: "10px 0", borderRadius: "5px" }}/>
      <button type="submit" onClick={handleSubmit} style={{ width: "100%", padding: "10px", backgroundColor: "#2A483A", color: "#fff", borderRadius: "5px", border: "none", cursor: "pointer" }}>Register</button>
    </div>
  );
}

export default Register;
