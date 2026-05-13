import React, { useState, useEffect } from "react";
import axios from "axios";
import { OTPField } from "./BaseOTPField.jsx";
import styles from "../styles/index.module.css";

export default function OTPStep({ phoneNumber, onVerify }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResendDisabled(false);
    }
  }, [countdown]);

  const handleComplete = async (value) => {
    if (value.length === 6) {
      setLoading(true);
      setError("");
      try {
        await onVerify(value);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    setResendDisabled(true);
    setCountdown(60);
    setError("");

    try {
      await axios.post("/api/send-otp", { phoneNumber });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend code");
      setResendDisabled(false);
      setCountdown(0);
    }
  };

  return (
    <div>
      <h2>Verification Code</h2>
      <p>Code sent to your Telegram for {phoneNumber}</p>

      <div className={styles.Field}>
        <label className={styles.Label}>Enter 6-digit code</label>
        <OTPField.Root
          length={6}
          onValueComplete={handleComplete}
          className={styles.Root}
        >
          <div className={styles.Group}>
            {Array.from({ length: 6 }, (_, index) => (
              <OTPField.Input
                key={index}
                index={index}
                className={styles.Input}
                disabled={loading}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>
        </OTPField.Root>
      </div>

      {error && <div style={{ color: "red", margin: "8px 0" }}>{error}</div>}
      {loading && <div style={{ margin: "8px 0" }}>Verifying...</div>}

      <button
        onClick={handleResend}
        disabled={resendDisabled}
        style={{ marginTop: "16px", padding: "8px 16px" }}
      >
        {resendDisabled ? `Resend in ${countdown}s` : "Resend Code"}
      </button>
    </div>
  );
}
