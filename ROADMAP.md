# ss14help v2 — Roadmap

> A multi-server crafting and chemistry guide for Space Station 14, kept up to date automatically from each server's game repository.

v2 is being built on the `v2` branch, which starts with its own history and shares none with v1. The `main` branch still holds the v1 Flask app, and that app stays live on Vercel until Phase 8.

---

## 0. Vision & principles

- **Frontend first.** The product is the UI. The backend exists only to produce correct data.
- **Data is a versioned static artifact.** Each server gets a snapshot of JSON files, generated from a pinned commit SHA. No database and no runtime API.
- **Never publish unvalidated data.** A failed import leaves the last good snapshot live, stops updates for that server and alerts the dev.
- **Servers are isolated.** If Starlight's import breaks, upstream keeps updating, and the other way round.
- **Adding a server means adding config.** A new server should be one entry in `servers.yaml`, unless it brings new prototype types.
- **Zero cost.** Vercel Hobby plus GitHub Actions on a public repo.

### v1.0 scope

| In | Out (backlog) |
|---|---|
| Chemical reactions | Lathe recipes |
| Reagent metadata (localized name, description, colour, group) | Construction and crafting graphs |
| Cooking: microwave, plus Starlight's extra devices | User accounts and synced favourites |
| Grinding and juicing sources (`Extractable`) | Translations |
| Servers: **Wizard's Den (upstream)** and **Starlight** | Other servers |

---

## 1. Target architecture

```
ss14help (branch v2)
├── apps/web/            Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
├── packages/calc/       Pure TS calculator engine (no React), tested with Vitest
├── packages/schema/     TS types generated from the JSON Schema
├── pipeline/            Python 3.12 · uv · Pydantic v2 · fluent.syntax · Dockerfile
│   ├── ss14help_pipeline/   fetch / parse / resolve / normalize / validate / diff / emit
│   └── tests/fixtures/      real YAML snippets for golden tests
├── schema/              JSON Schema exported from the Pydantic models (the contract)
├── data/
│   ├── upstream/        manifest.json · reagents.json · recipes.json · sources.json · search-index.json · CHANGELOG.md
│   └── starlight/       (same files)
├── servers.yaml         One entry per supported server
└── .github/workflows/   sync.yml (cron) · ci.yml (PRs)
```

`servers.yaml` sketch:

```yaml
servers:
  - id: upstream
    name: Wizard's Den
    repo: https://github.com/space-wizards/space-station-14
    branch: master
  - id: starlight
    name: Starlight
    repo: https://github.com/ss14Starlight/space-station-14   # confirm the URL
    branch: Starlight                                        # confirm the branch
    features: [deviceType, deepFrying, metamorph]
```

### Data flow

```
 GitHub Actions cron (every 6h) ──► matrix: one job per server
        │
        ▼
 open "pipeline-halt:<server>" issue? ──yes──► skip (halted)
        │ no
        ▼
 git ls-remote → HEAD SHA == manifest.sha? ──yes──► skip (nothing new)
        │ no
        ▼
 sparse shallow clone (Resources/Prototypes, Resources/Locale/en-US) @ SHA
        ▼
 parse every *.yml (catch-all tag loader) ──► index by (type, id)
        ▼
 resolve parent/abstract inheritance ──► localize (Fluent) ──► normalize to models
        ▼
 validate (structure · references · sanity · regression · schema version)
        │                                   │
     pass                                 fail
        ▼                                   ▼
 diff vs previous snapshot           open/update issue, add halt label,
 commit data/<server>/ + changelog   commit nothing, job fails (email)
        ▼
 Vercel builds apps/web (SSG) from data/ ──► live
```

---

## 2. Phase 0 — Foundations

**Goal:** an empty, working skeleton that deploys.

- [ ] Set up the orphan `v2` branch (done) and push it with `git push -u origin v2`.
- [ ] Set up the monorepo: pnpm workspaces for `apps/*` and `packages/*`, and uv for `pipeline/`.
- [ ] Add shared tooling: ESLint, Prettier, TypeScript strict mode, Ruff and mypy (or pyright), `.editorconfig`, and a `Makefile` or `justfile` with `pipeline`, `web` and `test` targets.
- [ ] Add `LICENSE` and an `ATTRIBUTION.md`: data comes from SS14 and fork repos; check each repo's license (upstream code is MIT, assets are mostly CC-BY-SA).
- [ ] Vercel:
  - On the existing project, set the root directory to `apps/web` *for preview deploys of `v2`*, and leave `main` as production.
  - Add an `ignoreCommand` so a commit only triggers a build when `apps/`, `packages/` or `data/` changed.
- [ ] Add a minimal `apps/web` page that deploys as a Vercel preview.

**Exit criteria:** `pnpm build` and `uv run pytest` both pass locally. A `v2` preview URL exists, and production (v1) is unaffected.

---

## 3. Phase 1 — UX design (before any UI code)

**Goal:** a layout that holds hundreds of recipes per server and keeps the user on one page.

### Layout: a three-pane workspace

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [ss14help]  [Server: Starlight ▾]   [ 🔍 Search recipes, reagents… ⌘K ]  data @a1b2c3 · 2d ago │
├──────────────┬──────────────────────────────┬─────────────────────────────┤
│ ★ PINNED     │ Medicine            [filter] │ ← Chemistry › Bicaridine     │
│  Bicaridine  │ ─────────────────────────────│ ■ Bicaridine          ★ pin  │
│  Tricord.    │ ■ Bicaridine    Inaprov.+Carb│ [Recipe][Tree][Calc][Used in]│
│ ⟲ RECENT     │ ■ Dexalin       O2+Plasma*   │ 1u Inaprovaline              │
│  Dexalin     │ ■ Dylovene      Si+K+N       │ 1u Carbon                    │
│ ▾ CHEMISTRY  │ ■ Kelotane      Si+C         │ → 2u Bicaridine              │
│   Medicine   │ …(virtualized list)          │ chips: [≥370K] [Centrifuge]  │
│   Drinks     │                              │       [catalyst: Plasma]     │
│   Chemicals  │                              │ ─ Calculator ─               │
│ ▾ COOKING    │                              │ Make [ 30 ]u → basic ingr.   │
│   Microwave  │                              │                              │
│   Oven …     │                              │                              │
│ ▸ SOURCES    │                              │                              │
└──────────────┴──────────────────────────────┴─────────────────────────────┘
```

- **Top bar**
  - Server switcher, which remembers the last server.
  - Global search as a command palette (⌘K or `/`). It searches names *and* ids and shows the category and server-only badges.
  - Data-version badge: commit SHA and age, linked to the per-server changelog.
- **Left sidebar**
  - Pinned favourites, then Recent, then a category tree (Chemistry › group, Cooking › device › group, Sources).
  - Collapsible, and becomes a drawer on mobile.
- **Center list**
  - Dense rows: colour swatch, name, a one-line ingredient summary, and condition icons.
  - Virtualized and filterable: by text, by "has heat requirement", by mixer type, by "server-only".
- **Right detail panel** (the core interaction)
  - Clicking a row opens the panel in place, with no navigation. The URL becomes `?r=<id>` so the view can be shared and works with Back.
  - Clicking an ingredient *pushes* it onto a panel stack, shown as breadcrumbs, so you can drill into the tree and come back.
  - Tabs:
    - **Recipe:** reactants, products, and condition chips for temperature, mixer, catalyst, device, time and secret recipe.
    - **Tree:** the expandable ingredient tree down to basic reagents and grind/juice sources.
    - **Calculator:** "Make **N**u of X". It outputs the basic-ingredient list, catalysts needed (not consumed), byproducts, and ordered steps.
    - **Used in:** reverse lookup.
  - On mobile the panel becomes a bottom sheet.
- **Keyboard:** `⌘K` search, `j/k` move in the list, `Enter` open, `Esc` close the panel or pop the stack, `p` pin, `1–4` switch tabs.

### Deliverables

- [ ] Low-fidelity wireframes (Excalidraw or Figma) for desktop, tablet and mobile.
- [ ] High-fidelity mockups for the list, the detail panel and its 4 tabs, the command palette and the calculator.
- [ ] Design tokens: dark theme first and a light theme, with reagent colours as accents (contrast-checked).
- [ ] Keyboard map and accessibility checklist: focus order, ARIA for the tree and tabs, `prefers-reduced-motion`.

**Exit criteria:** you'd be comfortable using the mockups yourself. The calculator flow is answered with a real example (e.g. "30u of a 3-level-deep drink") on paper.

---

## 4. Phase 2 — Data contract

**Goal:** one source of truth for the data shape, shared by the Python and TS code.

- [ ] Pydantic v2 models in `pipeline/ss14help_pipeline/models.py`:
  - `Reagent`: `id`, `name`, `desc`, `physicalDesc`, `group`, `color`, `sourceFile`, `serverOnly`.
  - `Reaction`:
    - `id`, `reactants: {id: {amount, catalyst}}`, `products: {id: amount}`
    - `minTemp`, `maxTemp`, `mixers[]`, `quantized`, `priority`
    - `effects[]`, kept as an opaque `{_type, ...}` and shown as text only.
  - `CookingRecipe`: `id`, `name`, `device` (default `Microwave`), `time`, `solids{}`, `reagents{}`, `result`, `group`, `secret`.
  - `Source`: an entity id with its name and its grind/juice reagents and amounts.
  - `Manifest`: `server`, `repo`, `sha`, `commitDate`, `generatedAt`, `schemaVersion` (semver), `counts{}`, `warnings[]`.
- [ ] Export the models to `schema/*.json` and generate `packages/schema` TS types with `json-schema-to-typescript`. CI fails if the generated files are stale.
- [ ] Schema versioning: a major bump means the frontend must change. The web build refuses data whose major version doesn't match.

**Exit criteria:** hand-written sample data validates in Python *and* type-checks in TS.

---

## 5. Phase 3 — Pipeline MVP (upstream only, local)

**Goal:** `docker run ss14help-pipeline upstream` produces a correct `data/upstream/`.

- [ ] **fetch:** a shallow, sparse clone of `Resources/Prototypes` and `Resources/Locale/en-US` at a given SHA. Cache it between runs.
- [ ] **parse:** walk *every* `*.yml`. The game loads the whole tree, so there's no hardcoded file list.
  - Use a YAML SafeLoader with a **catch-all multi-constructor** for unknown tags (`!type:*`, `!PartialOnly`, `!Remove`, `!Clear`, `!Index`, `!CombineIndex`, …). It keeps the tag as `_type` (or `_tag`) and never crashes on a new tag.
  - Record `sourceFile` on every prototype, so `_Starlight/…` and other fork folders can be detected.
- [ ] **index:** a `{type: {id: prototype}}` index. Report duplicate ids as warnings, with last-loaded winning, which mirrors engine behaviour.
- [ ] **resolve:** `parent` inheritance (single and multiple parents) and `abstract` handling, following the engine's merge semantics.
- [ ] **localize:** parse `.ftl` with `fluent.syntax` and resolve `reagent-name-*` and `reagent-desc-*`. Entity names come straight from YAML `name:`.
- [ ] **normalize:**
  - Map prototypes to the models: `reaction` and `reagent`; `microwaveMealRecipe` → `CookingRecipe`; `mixingCategory` → mixer labels.
  - Compute `hasRecipe` and `isBasic` (this replaces v1's `basic` flag).
- [ ] **emit:** deterministic JSON (sorted keys and ids, stable float formatting) so git diffs stay readable, plus `search-index.json`.
- [ ] Golden tests that use real YAML fixtures covering catalysts, `maxTemp`, multi-product reactions, `!type:` effects, inheritance and fluent names.

Lessons from v1's `autoupdate/`:
- Drop the `str(dict)` → JSON hack.
- Drop the per-tag Python classes and the hardcoded file list.
- Fix the cooking template bug where recipes with both solids *and* reagents lost their reagents.

**Exit criteria:** the upstream snapshot is generated. Counts are about 350 reactions, about 477 reagents and about 320 cooking recipes (the order of magnitude seen in today's tree). A spot check of 20 recipes against the game's files and the wiki matches.

---

## 6. Phase 4 — Validation, halt & alert, automation

**Goal:** the pipeline runs unattended and never publishes broken data.

### Validation layers (`validate.py`)

1. **Structural:** Pydantic models with strict types.
2. **Referential integrity:**
   - Every reactant, product, catalyst, solid, cooking reagent and result id resolves to a known reagent or entity.
   - Unresolvable ids are only allowed if they are on `pipeline/allowlist.yaml`.
3. **Sanity:** amounts > 0, `0 < minTemp < maxTemp`, cooking time ≥ 0, no reaction whose products equal its reactants.
4. **Regression guard:** fail if any count (reactions, reagents, cooking recipes, sources) drops by more than **10%** against the last published snapshot. This catches a parser silently missing a folder.
5. **Contract:** the output validates against `schema/` for the current `schemaVersion`.

Warnings (duplicates, new unknown tags, new prototype types) don't fail the run. They go into `manifest.warnings` and the changelog.

### GitHub Actions: `sync.yml`

- [ ] Triggers: `schedule: "0 */6 * * *"` and `workflow_dispatch` (with an optional `server` and a `force` flag).
- [ ] `strategy.matrix.server` comes from `servers.yaml`, with `fail-fast: false` so servers stay isolated. Use `concurrency` per server.
- [ ] Steps:
  1. halt check
  2. `ls-remote` SHA check
  3. run the pipeline container
  4. validate
  5. diff
  6. commit `data/<server>/` with a message like `data(starlight): a1b2c3 → d4e5f6 (+3 reactions, ~5 changed)`
  7. push
- [ ] **Halt and alert:**
  - On validation failure: commit nothing, and open (or comment on) an issue titled `Pipeline halted: <server>`, labelled `pipeline-halt` and `server:<server>`. The body holds the validation report, the offending SHA and links to the files.
  - The job fails, so GitHub emails you. Optionally, also post to a Discord webhook secret.
  - Later runs skip that server while the issue is **open**. **Closing the issue resumes** updates.
- [ ] `ci.yml` for PRs and pushes to `v2`: lint, type-check, pipeline tests, calc tests, schema-staleness check and the web build.

**Exit criteria:**
- A deliberately broken fixture causes a halt with an issue, and real data is untouched.
- Closing the issue resumes updates.
- A week of scheduled runs completes unattended.

---

## 7. Phase 5 — Calculator engine (`packages/calc`)

**Goal:** exact, explainable amounts. This is a pure TS library with no UI.

- [ ] Build a bipartite graph of reagent nodes and reaction nodes from `recipes.json`, plus cooking recipes and sources.
- [ ] `plan(target, amountU, options)`:
  - Scale each reaction by `amountU / productAmount(target)`.
  - **Catalysts** are reported as *required present, not consumed* and are not multiplied by depth.
  - **Multi-product reactions:** report the other products as byproducts or leftovers. If a byproduct is consumed later in the tree, credit it.
  - **`quantized` reactions:** round up to whole batches and report the overshoot.
  - **Several recipes for the same reagent:** pick deterministically by default (the fewest steps, then the priority), and let the user override each node.
  - **"Treat as owned":** stop expanding at chosen intermediates.
  - **Cycle detection:** stop and mark the cycle instead of recursing forever.
- [ ] Outputs:
  - `basics`: aggregated basic ingredients, plus the grind/juice sources for each one.
  - `catalysts`, `byproducts`, `tree`.
  - `steps[]`: ordered, human-readable instructions with conditions, e.g. "Mix 10u Oxygen + 10u Potassium, heat to ≥ 370K, then add …".
- [ ] Use exact arithmetic (rationals or integer milli-units) internally, and format to 2 decimals only when displaying, since SS14 uses fixed-point 0.01u.
- [ ] Vitest:
  - Unit tests.
  - Property tests (fast-check): scaling is linear, and catalysts never scale.
  - Fixtures from real upstream data, including the v1 calculator's known failure cases (first-product-only, scaled catalysts).

**Exit criteria:** for 15 hand-verified recipes, including 3 or more levels deep, catalysts, multi-product and quantized ones, the engine's output matches manual calculation.

---

## 8. Phase 6 — Frontend build

**Goal:** implement the Phase 1 design on top of the data and the calc engine.

- [ ] Routing and rendering:
  - `/` → redirect to the last-used or default server.
  - `/[server]`: the workspace (client-side), with its shell statically generated.
  - `/[server]/r/[id]`: statically generated (`generateStaticParams`) for SEO and deep links. It renders the same workspace with the panel open.
- [ ] Load data at build time from `data/<server>/`, and check `schemaVersion` there.
- [ ] Search: MiniSearch from the prebuilt `search-index.json`, with fuzzy and prefix matching over names, ids and aliases.
- [ ] State:
  - URL holds the server, the open recipe, the tab and the calc amount.
  - localStorage holds pins, recent items and the last server, keyed by server and wrapped in try/catch.
- [ ] Components: virtualized list (TanStack Virtual), command palette (cmdk), detail-panel stack, tree view, calculator form and results, condition chips.
- [ ] Extras: a copy-as-text recipe button, a server-only badge, a stale-data banner when the snapshot is more than 14 days old, and a data-version footer that links to the changelog.
- [ ] Quality:
  - Lighthouse ≥ 90 for performance and accessibility.
  - Playwright smoke tests: search, open the panel, drill into an ingredient, calculate, pin, switch server.

**Exit criteria:** the full flow works on the upstream data in a Vercel preview, on desktop and on mobile.

---

## 9. Phase 7 — Multi-server: Starlight + sources

**Goal:** a second server with its fork-specific content, and recipe trees that end in obtainable items.

- [ ] Add Starlight to `servers.yaml`, and confirm the repo URL and branch.
- [ ] Fork awareness:
  - Fork content lives in underscore folders (`_Starlight`, `_Mono`, `_FarHorizons`, `_Funkystation`, …, plus `DeltaV`) and in inline `# Starlight-Start/End` edits to upstream files.
  - The parser already loads everything. Additionally, set `serverOnly` by comparing ids with the upstream snapshot.
- [ ] Starlight extensions:
  - `deviceType` on cooking recipes (Oven, etc.), which fills `CookingRecipe.device`.
  - `deepFryingRecipe` and `metamorphRecipe` (`sequence_metamorph.yml`) are modeled as cooking variants, or shown generically.
  - `extractReaction` (xenobiology) is deferred to the backlog and recorded as a warning.
- [ ] **Sources (both servers):**
  - Scan entity prototypes for the `Extractable` component: `grindableSolutionName` resolves to the entity's solution contents, and `juiceSolution.reagents` lists the juice reagents.
  - Emit `sources.json` and link the sources to the reagents' "basic" leaves in the tree and the calculator.
- [ ] UI: server-only badges and filter, and an optional "compare with upstream" diff on a recipe.

**Exit criteria:**
- Both servers sync on schedule independently, and a Starlight halt doesn't affect upstream.
- Trees for common drinks and medicines end in grindable or juiceable items.

---

## 10. Phase 8 — Launch

- [ ] Final QA pass, and get feedback from a few players on each server.
- [ ] Make `v2` the GitHub default branch and set the Vercel production branch to `v2`. Tag the old `main` as `v1-legacy` and keep it.
- [ ] Redirect old v1 URLs to the new routes.
- [ ] Check free-tier headroom:
  - Vercel Hobby allows 100 deploys a day; expect fewer than 10 data commits a day across both servers.
  - The `ignoreCommand` skips unrelated commits.
  - Public repos get unlimited Actions minutes.
- [ ] Monitoring: a sync-workflow status badge in the README and footer. Halt issues are the alert channel.
- [ ] Write a README covering architecture, how to add a server, and how to resume after a halt.

**Exit criteria:** production runs v2. One full week passes with automatic updates and no manual action, or a halt that was handled through the issue flow.

---

## 11. Post-v1 backlog

- Lathe recipes (about 1.5k `latheRecipe`, with `parent` inheritance and `latheRecipePack`).
- Construction and crafting graphs (`construction` and `constructionGraph` node/edge graphs, about 700 and 360). These need their own graph UI.
- More servers, added through `servers.yaml`.
- A per-server changelog page ("what changed this week"), built from the snapshot diffs.
- Xenobiology `extractReaction`, atmos `gasReaction`, and slicing (`ToolRefinable` / `SliceableFood`).
- An optional FastAPI service (Docker), only if accounts, synced favourites or a public data API are wanted.
- Translations, using the other `Resources/Locale/*` folders.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Upstream or fork schema churn (renamed fields, new tags) | A catch-all tag loader. Unknown tags and types become warnings, and structural breaks trigger the halt flow. |
| A parser silently loses data (folder moved) | Regression guard on counts, plus the referential-integrity check |
| Forks override upstream ids | Last-loaded wins, the same as the engine. Duplicates are logged as warnings. |
| Large game repos | Shallow, sparse clones of only `Resources/Prototypes` and `Resources/Locale/en-US` |
| Vercel build limits | Data is about 1–3 MB per server. `ignoreCommand`, and a commit only when the SHA changed. |
| Calculator mistakes erode trust | Exact arithmetic, property tests, and shown steps so users can check the math |
| A solo maintainer with little time | The halt and issue flow means maintenance only when something breaks. New servers are config-only. |
