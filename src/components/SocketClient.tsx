"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface SocketClientProps {
  isLoggedIn: boolean;
}

export function SocketClient({ isLoggedIn }: SocketClientProps) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    if (isLoggedIn) {
      if (!socketRef.current && !isConnectingRef.current) {
        console.log("Initializing socket connection because user is authenticated...");
        isConnectingRef.current = true;
        
        // We first hit the API route to ensure the socket server is running
        fetch("/api/socket").finally(() => {
          if (!mounted) return;
          isConnectingRef.current = false;

          const socket = io({
            path: "/api/socket",
            addTrailingSlash: false,
          });

          socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
          });

          socket.on("disconnect", () => {
            console.log("Socket disconnected");
          });

          // Log all messages from the backend
          socket.onAny((eventName, ...args) => {
            console.log(`[Socket Message] ${eventName}:`, ...args);
          });

          socketRef.current = socket;
        });
      }
    } else {
      if (socketRef.current) {
        console.log("User not authenticated, disconnecting socket...");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isLoggedIn]);

  return null;
}
