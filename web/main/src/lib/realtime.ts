import { Socket } from "phoenix";

import { env } from "@/lib/env";

/**
 * The Phoenix socket URL for an API base URL.
 *
 * The backend mounts `KaarobarWeb.UserSocket` at `/socket` on the same host
 * as `/api/v1`, so the socket endpoint is the API origin with the API path
 * swapped out and the scheme moved to its websocket twin. Phoenix appends
 * `/websocket` itself.
 */
export function socketUrlFor(apiUrl: string): string {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/socket";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

let shared: { token: string; socket: Socket } | null = null;

/**
 * One socket per signed-in token, shared by every channel on the page.
 *
 * `UserSocket.connect/3` authenticates with the same bearer token the REST
 * calls use, so a token change (sign-out, switching user) must mean a new
 * socket — the old one is disconnected rather than left authenticated as
 * somebody else.
 */
export function getSocket(token: string): Socket {
  if (shared?.token === token) return shared.socket;

  shared?.socket.disconnect();
  const socket = new Socket(socketUrlFor(env.apiUrl), { params: { token } });
  socket.connect();
  shared = { token, socket };
  return socket;
}
