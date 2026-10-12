import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (errorCode?: string) => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // If site key is not configured in local development, bypass challenge
  useEffect(() => {
    if (!siteKey) {
      onSuccess("");
    }
  }, [siteKey, onSuccess]);

  useEffect(() => {
    if (!siteKey) return;

    // Load Cloudflare Turnstile script dynamically if not present
    const SCRIPT_ID = "cf-turnstile-script";
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => setScriptLoaded(true);
      document.head.appendChild(script);
    } else {
      if (window.turnstile) {
        setScriptLoaded(true);
      } else {
        script.addEventListener("load", () => setScriptLoaded(true));
      }
    }
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey || !scriptLoaded || !containerRef.current || !window.turnstile) return;

    // Clean up any existing widget before rendering
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // Ignore
      }
      widgetIdRef.current = null;
    }

    try {
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onSuccess(token);
        },
        "expired-callback": () => {
          onExpire?.();
        },
        "error-callback": () => {
          onError?.();
        },
        theme: "light",
        size: "flexible",
      });
      widgetIdRef.current = id;
    } catch (e) {
      console.warn("Turnstile render warning:", e);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, scriptLoaded, onSuccess, onError, onExpire]);

  if (!siteKey) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-2.5 text-center text-[11px] text-slate-500">
        🛡️ Bot verification active in dev mode (Turnstile site key omitted)
      </div>
    );
  }

  return (
    <div className="flex justify-center my-2">
      <div ref={containerRef} className="min-h-[65px] min-w-[300px]" />
    </div>
  );
}
