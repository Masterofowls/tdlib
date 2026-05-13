import React, { useEffect, useRef } from 'react';
import styles from '../styles/index.module.css';

export default function LoginStep({ onAuth }) {
  const BOT_USERNAME = 'mrdanauthbot';
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const callbackName = '__telegramLoginAuthCallback';

    window[callbackName] = (telegramUser) => {
      if (telegramUser?.hash) {
        onAuth(telegramUser);
      } else {
        alert('Authentication failed. Please try again.');
      }
    };

    containerRef.current.innerHTML = '';

    // Initialize Telegram Login Widget using official data attributes API.
    const loginScript = document.createElement('script');
    loginScript.src = 'https://telegram.org/js/telegram-widget.js?22';
    loginScript.async = true;
    loginScript.setAttribute('data-telegram-login', BOT_USERNAME);
    loginScript.setAttribute('data-size', 'large');
    loginScript.setAttribute('data-radius', '10');
    loginScript.setAttribute('data-request-access', 'write');
    loginScript.setAttribute('data-userpic', 'false');
    loginScript.setAttribute('data-onauth', `${callbackName}(user)`);
    loginScript.setAttribute('data-lang', 'en');

    containerRef.current.appendChild(loginScript);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      delete window[callbackName];
    };
  }, [onAuth]);

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h1>🔐 Secure Login</h1>
          <p>Sign in with your Telegram account</p>
        </div>

        <div className={styles.loginContent}>
          <div className={styles.telegramLoginWrapper}>
            <div id="telegram-login-container" ref={containerRef}></div>
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
