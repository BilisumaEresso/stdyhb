"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, Send, X } from "lucide-react";

export interface Toast {
  id: string;
  type?: "info" | "success" | "error" | "telegram";
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: Toast["type"], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "info", duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Tray */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          pointerEvents: "none",
          maxWidth: "calc(100vw - 32px)",
        }}
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`studyhub-toast studyhub-toast-${toast.type || "info"}`}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "14px",
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--shadow-lg)",
              backdropFilter: "blur(10px)",
              fontSize: "13.5px",
              fontWeight: 600,
              minWidth: "260px",
              maxWidth: "380px",
              animation: "toastSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {toast.type === "success" && (
              <CheckCircle2 size={17} style={{ color: "var(--green, #20C98B)", flexShrink: 0 }} />
            )}
            {toast.type === "error" && (
              <AlertCircle size={17} style={{ color: "var(--accent, #EF4444)", flexShrink: 0 }} />
            )}
            {toast.type === "telegram" && (
              <Send size={16} style={{ color: "var(--primary, #0878F9)", flexShrink: 0 }} />
            )}
            {toast.type === "info" && (
              <Info size={17} style={{ color: "var(--primary, #0878F9)", flexShrink: 0 }} />
            )}

            <span style={{ flex: 1, lineHeight: "1.4" }}>{toast.message}</span>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      showToast: (msg: string) => console.log("[Toast fallback]", msg),
    };
  }
  return context;
}

export default ToastProvider;
