"use client";
import { createBrowserClient } from "@supabase/ssr";
import { cloudConfig } from "./config";
export function browserSupabase() {
  const { url, key } = cloudConfig();
  return createBrowserClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(15000),
        }),
    },
  });
}
