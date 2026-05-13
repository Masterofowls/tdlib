import React, { useState, useEffect } from "react";
import axios from "axios";

export default function RegistrationStep({ onRegister }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needBotStart, setNeedBotStart] = useState(false);

  useEffect(() => {
    axios
      .get("/api/bot-info")
      .then((res) => setBotUsername(res.data.botUsername));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNeedBotStart(false);

    // Validate phone number
    let cleanNumber = phoneNumber.trim();
    if (!cleanNumber.startsWith("+")) {
      cleanNumber = "+" + cleanNumber;
    }

    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(cleanNumber)) {
      setError(
        "Please enter a valid phone number with country code (e.g., +1234567890)",
      );
      setLoading(false);
      return;
    }

    try {
      // First, try to request OTP
      const response = await axios.post("/api/request-otp", {
        phoneNumber: cleanNumber,
      });

      if (response.data.success) {
        onRegister(cleanNumber);
      }
    } catch (err) {
      if (
        err.response?.status === 404 &&
        err.response?.data?.needRegistration
      ) {
        // User needs to register first
        setNeedBotStart(true);
        setError(err.response?.data?.message || "Please register first");
      } else {
        setError(err.response?.data?.error || "Failed to request OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Telegram OTP Login</h2>
      <p>Enter your phone number to receive a verification code via Telegram</p>

      {needBotStart && (
        <div
          style={{
            background: "#e0f2fe",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #7dd3fc",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
            📱 First time setup:
          </p>
          <p style={{ margin: "0" }}>
            1. Open Telegram and search for <strong>@{botUsername}</strong>
            <br />
            2. Send <code>/start</code> to the bot
            <br />
            3. Then try logging in again
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label>Phone Number</label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              margin: "8px 0",
              fontSize: "16px",
            }}
          />
        </div>

        {error && (
          <div
            style={{
              color: "red",
              margin: "8px 0",
              padding: "8px",
              background: "#fee",
              borderRadius: "4px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "16px",
            background: "#0088cc",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send Verification Code"}
        </button>
      </form>

      <p
        style={{
          fontSize: "12px",
          color: "#666",
          textAlign: "center",
          marginTop: "20px",
        }}
      >
        We'll send a 6-digit code to your Telegram account
      </p>
    </div>
  );
}
