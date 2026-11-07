"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";

interface TelegramContextType {
  isInsideTelegram: boolean;
  user: any | null;
  triggerHaptic: (style?: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  closeApp: () => void;
}

const TelegramContext = createContext<TelegramContextType>({
  isInsideTelegram: false,
  user: null,
  triggerHaptic: () => {},
  closeApp: () => {},
});

export const useTelegram = () => useContext(TelegramContext);

export default function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const handleScriptLoad = () => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      setIsInsideTelegram(true);
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      }

      try {
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation?.();

        // Sync header and theme colors
        const isDark = document.documentElement.dataset.theme === "dark";
        tg.setHeaderColor?.(isDark ? "#071426" : "#F7FAFF");
        tg.setBackgroundColor?.(isDark ? "#071426" : "#F7FAFF");
      } catch (err) {
        console.warn("[TMA] Init error:", err);
      }
    }
  };

  // Run on mount in case script already loaded
  useEffect(() => {
    handleScriptLoad();
  }, []);

  // Sync back button with page routing
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    if (!tg || !tg.BackButton) return;

    if (pathname && pathname !== "/") {
      tg.BackButton.show();
      const onBack = () => router.back();
      tg.BackButton.onClick(onBack);
      return () => {
        tg.BackButton.offClick(onBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [pathname, router]);

  // Sync theme changes with Telegram header
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.dataset.theme === "dark";
      tg.setHeaderColor?.(isDark ? "#071426" : "#F7FAFF");
      tg.setBackgroundColor?.(isDark ? "#071426" : "#F7FAFF");
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const triggerHaptic = (style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    tg?.HapticFeedback?.impactOccurred(style);
  };

  const closeApp = () => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    tg?.close();
  };

  return (
    <TelegramContext.Provider
      value={{
        isInsideTelegram,
        user,
        triggerHaptic,
        closeApp,
      }}
    >
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
        onLoad={handleScriptLoad}
      />
      {children}
    </TelegramContext.Provider>
  );
}
