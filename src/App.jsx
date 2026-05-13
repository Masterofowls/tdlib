import React, { useState, useEffect } from "react";
import axios from "axios";
import RegistrationStep from "./components/RegistrationStep.jsx";
import OTPStep from "./components/OTPStep.jsx";
import ProfileStep from "./components/ProfileStep.jsx";

function App() {
  const [step, setStep] = useState("registration");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("telegram_jwt_token");
    if (savedToken) {
      verifyAndRestoreSession(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyAndRestoreSession = async (savedToken) => {
    try {
      const response = await axios.get("/api/me", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });

      if (response.data) {
        setToken(savedToken);
        setUser(response.data);
        setStep("profile");
      }
    } catch (error) {
      console.error("Session restoration failed:", error);
      localStorage.removeItem("telegram_jwt_token");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (phone) => {
    setPhoneNumber(phone);
    setStep("otp");
  };

  const handleVerify = async (otp) => {
    try {
      const response = await axios.post("/api/verify-otp", {
        phoneNumber,
        otp,
      });
      if (response.data.success) {
        localStorage.setItem("telegram_jwt_token", response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);
        setStep("profile");
      }
    } catch (error) {
      throw new Error(error.response?.data?.error || "Verification failed");
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await axios.post(
          "/api/logout",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    localStorage.removeItem("telegram_jwt_token");
    setToken(null);
    setUser(null);
    setPhoneNumber("");
    setStep("registration");
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      {step === "registration" && (
        <RegistrationStep onRegister={handleRegister} />
      )}
      {step === "otp" && (
        <OTPStep phoneNumber={phoneNumber} onVerify={handleVerify} />
      )}
      {step === "profile" && user && (
        <ProfileStep user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
