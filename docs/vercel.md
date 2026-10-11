# Vercel setup

v2 replaces v1 on the **existing** Vercel project. v1 is retired; its code is tagged `v1-legacy` for
reference. v2 now lives on `main`.

## Project settings (one-time, in the dashboard)

1. **Settings → Build and Deployment → Root Directory:** `apps/web`. Keep "Include files outside
   the root directory" enabled (the default), which pnpm workspaces need.
2. **Framework Preset:** Next.js. Leave the install and build commands at their defaults; Vercel
   detects pnpm from `pnpm-lock.yaml`.
3. Clear any **Build Command** or **Output Directory** overrides left over from the Flask setup.
4. **Settings → Environments → Production → Branch Tracking:** `main`.
5. Redeploy. [`apps/web/vercel.json`](../apps/web/vercel.json) has an `ignoreCommand` that skips a
   build unless `apps/web`, `packages/`, `data/` or the pnpm workspace files changed.

v1 had a single route (`/`), so no redirects are needed.

## GitHub

- Keep `main` as the default branch (Settings → General → Default branch). The scheduled data
  sync only runs on the default branch and commits to it, and Vercel deploys from it.
- The old code is tagged `v1-legacy`.
