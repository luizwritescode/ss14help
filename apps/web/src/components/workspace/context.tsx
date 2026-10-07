"use client";

import { createContext, useContext } from "react";
import type { ServerModel } from "@/lib/model";
import type { ServerInfo } from "@/lib/servers";
import type { Subject } from "@/lib/subjects";
import type { WorkspaceParams } from "@/lib/url-state";
import type { WorkspaceActions } from "./use-workspace";

export interface WorkspaceContextValue {
  server: ServerInfo;
  servers: ServerInfo[];
  model: ServerModel;
  params: WorkspaceParams;
  actions: WorkspaceActions;
  /** Top of the panel stack, if the panel is open. */
  top: Subject | null;
  pins: string[];
  togglePin(subject: Subject): void;
  removePin(key: string): void;
  recent: string[];
  removeRecent(key: string): void;
  toast(message: string): void;
  openPalette(): void;
  openHelp(): void;
  openAbout(): void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <Workspace>");
  return value;
}
