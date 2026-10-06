# Vercel setup

Vercel's _Root Directory_ is a per-project setting, not a per-branch one. So v2 can't share the
v1 project's settings while v1 is still live from `main`. Until launch (ROADMAP Phase 8), v2 runs
as a **second project** on the same Hobby account, connected to the same GitHub repo.

## v1 project (existing)

No dashboard changes are needed. The repo-root [`vercel.json`](../vercel.json) on the `v2` branch
sets `git.deploymentEnabled: false`, so the v1 project ignores pushes to `v2` instead of trying to
build them as Flask previews. `main` keeps deploying to production as before.

## v2 project (new)

1. Vercel → Add New → Project → import `luizwritescode/ss14help`.
2. **Root Directory:** `apps/web`. Turn on "Include files outside the root directory" (it's on by
   default), which pnpm workspaces need.
3. **Framework:** Next.js, detected automatically. Leave the install and build commands at their
   defaults; Vercel detects pnpm from `pnpm-lock.yaml`.
4. Settings → Git → **Production Branch:** `v2`.
5. Deploy. [`apps/web/vercel.json`](../apps/web/vercel.json) has an `ignoreCommand` that skips a
   build unless `apps/web`, `packages/`, `data/` or the lockfile changed.

## At launch (Phase 8)

Move the production domain from the v1 project to the v2 project, make `v2` the default GitHub
branch, and tag `main` as `v1-legacy`. Then archive or delete the v1 project.
