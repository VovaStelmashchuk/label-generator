"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // With response_type=token, Google puts the access_token in the URL hash fragment
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const googleAccessToken = hashParams.get("access_token");

    if (!googleAccessToken) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("error")) {
        setError(searchParams.get("error"));
        return;
      }
      setError("No access token provided by Google.");
      return;
    }

    // Prevent React Strict Mode from firing this twice
    if (hasFetched) return;
    setHasFetched(true);

    const authenticate = async () => {
      try {
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googleAccessToken }),
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            setError(data.error || `Authentication failed: ${response.status}`);
          } else {
            const text = await response.text();
            console.error("Non-JSON error response:", text);
            setError(`Authentication failed with status ${response.status}. See console for details.`);
          }
          return;
        }

        // Force a hard refresh to update server components
        window.location.href = "/generator";
      } catch (err) {
        setError(`An error occurred during authentication: ${String(err)}`);
      }
    };

    authenticate();
  }, [router, hasFetched]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      {error ? (
        <div className="text-red-500">Error: {error}</div>
      ) : (
        <div>Authenticating...</div>
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <CallbackHandler />
    </Suspense>
  );
}
