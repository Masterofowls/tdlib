import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './styles/index.module.css';
import LoginStep from './components/LoginStep.jsx';
import ProfileStep from './components/ProfileStep.jsx';

function App() {
  const [step, setStep] = useState('login');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has a valid token
    const savedToken = localStorage.getItem('telegram_jwt_token');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (savedToken) => {
    try {
      const response = await axios.get('/api/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });

      if (response.data.success) {
        setToken(savedToken);
        setUser(response.data.user);
        setStep('profile');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('telegram_jwt_token');
      setLoading(false);
    }
  };

  const handleTelegramAuth = async (telegramUser) => {
    setLoading(true);
    try {
      // Send Telegram data to backend for verification
      const response = await axios.post('/api/auth/telegram', telegramUser);

      if (response.data.success && response.data.token) {
        const { token: newToken, user: newUser } = response.data;

        // Save token to localStorage
        localStorage.setItem('telegram_jwt_token', newToken);

        // Update state
        setToken(newToken);
        setUser(newUser);
        setStep('profile');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      alert('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('telegram_jwt_token');
    setToken(null);
    setUser(null);
    setStep('login');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {step === 'login' && <LoginStep onAuth={handleTelegramAuth} />}
      {step === 'profile' && user && (
        <ProfileStep user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
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
