import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/index.module.css';

export default function LoginStep({ onAuth }) {
  const BOT_USERNAME = 'mrdanauthbot';
  const containerRef = useRef(null);
  const [loginMode, setLoginMode] = useState('native');
  const [nativeLoading, setNativeLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current || loginMode !== 'manual') {
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
  }, [onAuth, loginMode]);

  const startNativeLogin = () => {
    setNativeLoading(true);

    const start = Date.now();
    let fallbackTimer;

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(fallbackTimer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        setNativeLoading(false);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    // If Telegram app is not installed, browser stays visible and we switch to manual mode.
    fallbackTimer = setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);

      if (!document.hidden && Date.now() - start >= 1400) {
        setLoginMode('manual');
      }

      setNativeLoading(false);
    }, 1500);

    window.location.href = `tg://resolve?domain=${BOT_USERNAME}`;
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h1>🔐 Secure Login</h1>
          <p>Sign in with your Telegram account</p>
        </div>

        <div className={styles.loginContent}>
          {loginMode === 'native' && (
            <div className={styles.nativeLoginWrapper}>
              <button
                type="button"
                className={styles.nativeLoginButton}
                onClick={startNativeLogin}
                disabled={nativeLoading}
              >
                {nativeLoading
                  ? 'Checking Telegram app...'
                  : 'Login with installed Telegram app'}
              </button>
              <p className={styles.nativeHint}>
                If Telegram is not installed, we will switch to manual phone
                typing automatically.
              </p>
            </div>
          )}

          {loginMode === 'manual' && (
            <div className={styles.telegramLoginWrapper}>
              <div id="telegram-login-container" ref={containerRef}></div>
            </div>
          )}

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
