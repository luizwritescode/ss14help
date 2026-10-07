"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_SERVER, findServer } from "@/lib/servers";
import { getJSON, keys } from "@/lib/storage";

export function RedirectToLastServer() {
  const router = useRouter();
  useEffect(() => {
    const last = getJSON<string | null>(keys.lastServer, null);
    router.replace(`/${last && findServer(last) ? last : DEFAULT_SERVER}`);
  }, [router]);
  return null;
}
