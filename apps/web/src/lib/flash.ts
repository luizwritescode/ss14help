"use client";

/** A message for the next workspace to show, e.g. after switching servers (client navigation). */
let pending: string | null = null;

export function setFlash(message: string): void {
  pending = message;
}

export function takeFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
