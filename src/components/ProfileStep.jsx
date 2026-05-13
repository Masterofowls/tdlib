import React from 'react';
import styles from '../styles/index.module.css';

export default function ProfileStep({ user, onLogout }) {
  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.firstName}
              className={styles.profilePhoto}
            />
          ) : (
            <div className={styles.profilePhotoPlaceholder}>
              {(user.firstName?.[0] || 'U').toUpperCase()}
            </div>
          )}
        </div>

        <h2 className={styles.profileName}>
          {user.firstName} {user.lastName}
        </h2>

        <p className={styles.profileUsername}>
          @{user.username || 'No username set'}
        </p>

        <div className={styles.profileStats}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>✅</div>
            <div className={styles.statLabel}>Verified</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{user.loginCount}</div>
            <div className={styles.statLabel}>Logins</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>📱</div>
            <div className={styles.statLabel}>Telegram User</div>
          </div>
        </div>

        <div className={styles.profileInfo}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Telegram ID:</span>
            <span className={styles.infoValue}>{user.telegramId}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Login Count:</span>
            <span className={styles.infoValue}>{user.loginCount}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Last Login:</span>
            <span className={styles.infoValue}>
              {new Date(user.lastLogin).toLocaleString()}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Member Since:</span>
            <span className={styles.infoValue}>
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className={styles.logoutButton}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
