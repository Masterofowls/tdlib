import React, { useEffect } from 'react';
import styles from '../styles/index.module.css';

export default function LoginStep({ onAuth }) {
  const BOT_USERNAME = 'mrdanauthbot';

  useEffect(() => {
    // Load Telegram script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    document.body.appendChild(script);

    // Load Telegram Login Widget script
    const loginScript = document.createElement('script');
    loginScript.src = 'https://telegram.org/js/telegram-widget.js?22';
    loginScript.async = true;
    loginScript.onload = () => {
      // Initialize Telegram Login Widget
      if (window.Telegram?.Login) {
        window.Telegram.Login.embed({
          bot_id: '7627661285', // Get this from @BotFather
          size: 'large',
          onAuthCallback: (user) => {
            handleTelegramAuth(user);
          },
        });
      }
    };
    document.getElementById('telegram-login-container').appendChild(loginScript);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleTelegramAuth = (telegramUser) => {
    // Add hash to the data for verification
    if (telegramUser.hash) {
      onAuth(telegramUser);
    } else {
      alert('Authentication failed. Please try again.');
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h1>🔐 Secure Login</h1>
          <p>Sign in with your Telegram account</p>
        </div>

        <div className={styles.loginContent}>
          <div className={styles.telegramLoginWrapper}>
            <div id="telegram-login-container"></div>
          </div>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <p className={styles.infoText}>
            Don't have Telegram? Download it from{' '}
            <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">
              telegram.org
            </a>
          </p>
        </div>

        <div className={styles.loginFooter}>
          <p className={styles.securityNote}>
            ✅ Your data is protected and verified by Telegram
          </p>
        </div>
      </div>
    </div>
  );
}
