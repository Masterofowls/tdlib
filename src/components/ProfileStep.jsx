import React from "react";

export default function ProfileStep({ user, onLogout }) {
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        {user.profilePhoto ? (
          <img
            src={user.profilePhoto}
            alt="profile"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#667eea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              margin: "0 auto",
              color: "white",
            }}
          >
            {(
              user.firstName?.[0] ||
              user.phoneNumber?.[1] ||
              "U"
            ).toUpperCase()}
          </div>
        )}
      </div>

      <h2 style={{ textAlign: "center" }}>
        {user.firstName} {user.lastName || ""}
      </h2>

      <p style={{ textAlign: "center", color: "#666" }}>
        @{user.username || "No username"}
      </p>

      <p style={{ textAlign: "center", marginBottom: "24px" }}>
        📱 {user.phoneNumber}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          margin: "24px 0",
          padding: "16px",
          background: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>✅</div>
          <div style={{ fontSize: "12px" }}>Verified</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {user.chatId}
          </div>
          <div style={{ fontSize: "12px" }}>Chat ID</div>
        </div>
      </div>

      <button
        onClick={onLogout}
        style={{
          width: "100%",
          padding: "12px",
          background: "#dc2626",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
