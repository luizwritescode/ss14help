# ss14help v2 — Roadmap

> A multi-server crafting and chemistry guide for Space Station 14, kept up to date automatically from each server's game repository.

v2 is being built on the `v2` branch, which starts with its own history and shares none with v1. v1 (the Flask app on `main`) is retired: v2 takes over the existing Vercel project from Phase 0, and `main` is kept only for reference, tagged `v1-legacy`.

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
│   ├── upstream/        manifest.json · reagents.json · entities.json · recipes.json · sources.json · search-index.json · CHANGELOG.md
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
    repo: https://github.com/ss14Starlight/space-station-14
    branch: starlight-dev
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

- [x] Set up the orphan `v2` branch.
- [ ] Push it with `git push -u origin v2`.
- [x] Set up the monorepo: pnpm workspaces for `apps/*` and `packages/*`, and uv for `pipeline/`.
- [x] Add shared tooling: ESLint, Prettier, TypeScript strict mode, Ruff and mypy, `.editorconfig`, and a `Makefile` (`install`, `web`, `pipeline`, `test`, `lint`, `build`, `docker`). Also added `ci.yml`.
- [x] Add `LICENSE` (MIT) and `ATTRIBUTION.md`. Starlight's legacy license requires attribution with a link to its repo.
- [x] Vercel config in the repo: `apps/web/vercel.json` has an `ignoreCommand` so a commit only triggers a build when `apps/web`, `packages/`, `data/` or the lockfile changed.
- [ ] Retire v1 and point the **existing** Vercel project at v2: Root Directory `apps/web`, production branch `v2` (manual, steps in [docs/vercel.md](docs/vercel.md)).
- [ ] Make `v2` the GitHub default branch and tag `main` as `v1-legacy`.
- [x] Add a minimal `apps/web` placeholder page that imports `@ss14help/calc`, to prove the workspace wiring.

**Exit criteria:** `pnpm build` and `uv run pytest` both pass locally. The production URL serves the v2 placeholder.

---

## 3. Phase 1 — UX design (before any UI code)

**Goal:** a layout that holds hundreds of recipes per server and keeps the user on one page.

**Deliverable:** this section. It is the spec for the UI pass (Phase 6). Each component lists its job, contents, behaviour, states and acceptance checks. Data field names refer to the contract in Phase 2 (`schema/ss14help.schema.json`; TS types from `@ss14help/schema`).

### 3.1 Layout: a three-pane workspace

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [ss14help] [Starlight ▾]        [ 🔍 Search recipes, reagents…  ⌘K ]   @a1b2c3d · 2d ago ☾ ? │  TopBar (48px)
├──────────────┬───────────────────────────────────┬───────────────────────────────────────┤
│ ★ PINNED     │ Medicine · 57           [⌕ filter]│ ‹ Bicaridine › Inaprovaline        ✕  │  PanelHeader
│  ■ Bicaridine│ [🔥 Heat] [⚗ Mixer ▾] [◇ Catalyst] │ ■ Inaprovaline             ⧉  ★  ⎘   │
│  ■ Tricord.  │ ───────────────────────────────────│ [Recipe] [Tree] [Calculator] [Used in 4]│  Tabs
│ ⟲ RECENT     │ ■ Bicaridine  Inaprov. + Carbon 🔥⚗│ 1u ■ Oxygen                           │
│  ■ Dexalin   │▌■ Inaprovaline Oxygen + Sugar + 1  │ 1u ■ Sugar                            │
│ ▾ CHEMISTRY  │ ■ Dylovene    Silicon + Potas… ◇   │ 1u ■ Carbon                           │
│   Medicine 57│ ■ Kelotane    Silicon + Carbon     │ ─────────────── ▼ ───────────────     │
│   Drinks  127│ … (virtualized)                    │ 3u ■ Inaprovaline                     │
│ ▸ COOKING    │                                    │ [≥ 370 K] [Centrifuge] [◇ catalyst]   │  ConditionChips
│ ▸ REAGENTS   │                                    │ Stabilizes breathing in critical …    │
│ ▸ SOURCES    │                                    │                                       │
└──────────────┴───────────────────────────────────┴───────────────────────────────────────┘
   Sidebar 240px      RecipeList (flex, min 360px)        DetailPanel (440px, resizable 360–720)
```

Breakpoints (Tailwind defaults):

| Width | Sidebar | List | Panel |
|---|---|---|---|
| ≥ 1280px (`xl`) | Docked, collapsible to a 48px icon rail | Visible | Docked, resizable; width persisted |
| 768–1279px (`md`) | Drawer from the left (hamburger in TopBar) | Visible | Sheet over the list from the right, 480px, with a dimmed backdrop |
| < 768px | Drawer | Full width | Bottom sheet with snap points at 50% and 100% height; swipe down or `Esc` closes |

The page never scrolls as a whole on desktop: each pane scrolls on its own. Mobile uses a 16px side gutter, and nothing may cause horizontal scroll.

### 3.2 Concepts the UI is built on

**Subject.** What the detail panel shows. There are three kinds, written `kind:id` in URLs and storage:

| Kind | Source in data | Opened from | Panel tabs |
|---|---|---|---|
| `reagent` | `reagents.json` | Reaction rows, reagent rows, any reagent link | Recipe · Tree · Calculator · Used in |
| `item` | `entities.json` | Cooking rows, source rows, any solid ingredient | Recipe · Tree · Calculator · Used in · Sources (only if it has grind/juice output) |
| `reaction` | Reactions in `recipes.json` with **no products** (effect-only, e.g. explosions) | Their reaction rows | Recipe only |

- Clicking a **reaction row** opens `reagent:<primary product>` with that reaction pre-selected (`via=<reactionId>`). The primary product is the product whose id equals the reaction id; otherwise it's the largest product amount, then the first id alphabetically.
- Clicking a **cooking row** opens `item:<result>`. Cooking recipes are always shown inside their result item, never on their own.
- **Variants:** a reagent can be produced by several reactions, and an item by several cooking recipes. The panel shows one at a time with a VariantSwitcher. The default variant follows the calc engine's rule (`RecipeGraph.defaultProducer`): recipes where it is the primary product first, then fewest steps, then highest priority, then id.
- **Basic reagent:** a reagent that is dispensable (`Reagent.dispensable`) or that no reaction produces (`RecipeGraph.isBasic`). Its tree ends here, and its Recipe tab shows where to get it instead (sources).

**Categories (sidebar tree)** are derived from data, never hard-coded per server:

| Top level | Children | List shows |
|---|---|---|
| Chemistry | One node per `Reaction.category` (label map below; unknown categories are title-cased) | Reaction rows |
| Cooking | One node per `CookingRecipe.device`, then per `group` (null → "Other") | Cooking rows |
| Reagents | One node per `Reagent.group` (null → "Other") | Reagent rows |
| Sources | "Grindable", "Juiceable" | Source rows |

The category label map lives in `apps/web/src/lib/categories.ts`, e.g. `single_reagent → "Single reagent"` and `pyrotechnic → "Pyrotechnics"`. Order: Chemistry categories by count, descending; everything else alphabetically.

### 3.3 URL and persisted state

The URL is the source of truth for what is on screen, so every view can be shared and Back/Forward work.

| Route | Rendering | Purpose |
|---|---|---|
| `/` | Redirect | To the last-used server (localStorage), else `upstream` |
| `/[server]` | SSG shell, client workspace | The app |
| `/[server]/reagent/[id]`, `/[server]/item/[id]` | SSG (`generateStaticParams`) | SEO and link previews. Renders the workspace with the panel open, plus `<title>`/meta description and `rel=canonical` to itself |

| Query param | Example | Meaning |
|---|---|---|
| `open` | `reagent:Bicaridine,reagent:Inaprovaline` | Panel stack, bottom → top. The last entry is visible. Absent = panel closed |
| `via` | `Bicaridine` | Selected variant (reaction or cooking recipe id) for the top subject |
| `v.<id>` | `v.Inaprovaline=InaprovalineAlt` | Variant choices for intermediates, shared by the Tree and Calculator tabs |
| `tab` | `recipe` \| `tree` \| `calc` \| `used` \| `sources` | Active panel tab (default `recipe`) |
| `amt` | `30` | Calculator target amount (u for reagents, count for items) |
| `cat` | `chemistry/medicine` | Selected sidebar node / list contents. Default `chemistry` (all reactions) |
| `q` | `bica` | List filter text |
| `f` | `heat,catalyst,mixer:Centrifuge,serverOnly` | Active list filter chips |

Navigation rules:
- Opening a subject from the list, palette or sidebar → `router.push` with `open=<subject>`, which resets the stack.
- Clicking a link inside the panel → `router.push`, appending to `open` (max depth 12; deeper pushes drop the bottom entry).
- Back pops naturally through browser history. Breadcrumb clicks truncate the stack (`push`, not history back).
- Changing `q`, `f`, `amt` → `router.replace`, debounced 250ms, so typing doesn't flood history.
- Use shallow client navigation only. Nothing re-fetches: all server data is loaded once per server page.

localStorage (all access wrapped in try/catch; the app must work with storage unavailable):

| Key | Value |
|---|---|
| `ss14help:lastServer` | Server id |
| `ss14help:pins:<server>` | `string[]` of `kind:id`, in pin order |
| `ss14help:recent:<server>` | `string[]` of `kind:id`, most recent first, max 20 (sidebar shows 8) |
| `ss14help:theme` | `system` \| `dark` \| `light` |
| `ss14help:ui` | `{ sidebarCollapsed, panelWidth, expandedNodes: string[] }` |

Pins or recents whose id no longer exists in the current data stay listed, greyed, with the note "Not in current data" and a remove button. They are never removed silently.

### 3.4 Components

Suggested layout: `apps/web/src/components/{shell,sidebar,list,panel,calc,primitives}/`. Build on shadcn/ui (Radix) for Dialog, Sheet, Tabs, Tooltip, HoverCard, DropdownMenu and Toast; cmdk for the palette; TanStack Virtual for long lists; lucide-react for icons.

#### Shell

**AppShell**: the CSS grid of TopBar, Sidebar, RecipeList and DetailPanel with the breakpoints from 3.1. It owns the data context: one `ServerData` object per page (reagents, entities, recipes, sources, manifest, plus prebuilt lookup maps `reagentById`, `entityById`, `producersOf`, `consumersOf`, `sourcesOf`). The maps are built once with `useMemo`.
- Acceptance: resizing the window across the breakpoints never loses the open subject, list scroll position or calculator input.

**TopBar**, left to right:
1. Logo/wordmark, linking to `/[server]`.
2. ServerSwitcher.
3. SearchTrigger: a fake input showing the "⌘K" hint (`Ctrl K` on non-Mac). Click opens CommandPalette. It is a centred, max 560px wide input on desktop and an icon button on mobile.
4. DataVersionBadge.
5. Theme toggle (system → dark → light).
6. `?` button that opens the KeyboardHelp dialog.

**ServerSwitcher**: a DropdownMenu listing the servers (from a build-time constant generated from `servers.yaml`), each with its name and data age.
- Switching navigates to `/[newServer]` and keeps `open`/`tab`/`amt` when the top subject's id exists on the new server. Otherwise it drops the stack and shows the toast "Bicaridine isn't on Starlight".
- Stores `ss14help:lastServer`.

**DataVersionBadge**: `@a1b2c3d · 2d ago` (short sha and relative `commitDate`).
- Tooltip: full sha, commit date, generated-at, server repo/branch, and the number of pipeline warnings.
- Clicking opens the GitHub commit URL in a new tab.
- Turns amber, with the text "Data may be outdated", when `generatedAt` is more than 14 days old.

#### Search

**CommandPalette** (cmdk inside a Dialog). This is the main way to find anything.
- **Index:** MiniSearch, loaded from `search-index.json` (Phase 6), with fields `name` (boost 3), `id` (boost 2) and `aliases`. Uses `prefix: true` and `fuzzy: 0.2`, and returns at most 50 results.
- **Result groups:** Reagents, Items, Reactions (effect-only), Actions.
- **Result row:** swatch or icon, name, id in muted monospace (only when it differs from the name), category label, and ServerOnlyBadge.
- **Empty query:** shows Pinned, then Recent, then Actions (switch server, toggle theme, keyboard help).
- **Calculator shortcut** (kept from v1): a query matching `^(\d+(\.\d+)?)\s*u?\s+(.+)$` (e.g. `30u bica`, `30 bicaridine`) puts the action "Calculate 30u of Bicaridine" first. It opens the subject with `tab=calc&amt=30`.
- **Keys:** `Enter` opens, `Shift+Enter` pins without opening, `Esc` closes. Arrow keys are handled by cmdk.
- **Acceptance:**
  - `bica` → Bicaridine is the first result.
  - `Bicaridine` matches by id even if the localized name differs.
  - `30u bica` → the calculate action is the first result.

#### Sidebar

**Sidebar**: three stacked sections. Pinned and Recent each collapse; Browse fills the remaining height and scrolls.

**PinnedList / RecentList**: rows show the swatch (or item icon) and the name. The active subject is highlighted.
- Hover or focus reveals an ✕ (unpin, or remove from recent).
- Pinned empty state: "Pin recipes with ★ or `p`."
- Recent records a subject each time it becomes the top of the panel stack.

**CategoryTree**: an ARIA `tree` with nodes from 3.2 and an item count per node (with filters applied: show "12 / 57" when filtered).
- Clicking a node sets `cat` and scrolls the list to the top.
- Expanded nodes persist in `ss14help:ui.expandedNodes`.
- Keyboard: arrow keys follow the WAI-ARIA tree pattern.

#### List

**RecipeList**: the center pane.
- **ListToolbar:**
  - Category title and count.
  - Filter input (`q`, filters the current category only; it is not the global search).
  - FilterChips: "Heat" (`minTemp` set), "Cold" (`maxTemp` set), "Mixer ▾" (any or a specific mixer), "Catalyst", and "Server-only" (hidden on upstream). Chips that would give 0 results are disabled.
  - Sort: Name A–Z (default) or "Simplest first" (by tree depth from the calc engine).
- **Rows** are 40px tall (52px on touch), virtualized with TanStack Virtual, and have one visual language per kind:
  - **ReactionRow:** swatch (primary product colour), product name, an ingredient summary of up to 3 reactant names joined by " + " plus "+N", then condition icons (🔥 heat, ❄ cold, ⚗ mixer, ◇ catalyst) and ServerOnlyBadge. Catalysts are excluded from the summary.
  - **CookingRow:** device icon, result item name, a summary of solids and reagents, and the time ("10 s" or "instant").
  - **ReagentRow:** swatch, name, group, and a "basic" tag when no reaction produces it.
  - **SourceRow:** item name, then "→" and the reagents it yields with amounts, plus a grind/juice icon.
- The row matching the top subject is highlighted, and the list scrolls it into view when the subject was opened from elsewhere.
- Keyboard: `j`/`k` or arrows move a roving focus, `Enter` opens, `p` pins.
- Empty state: "Nothing matches these filters", with a "Clear filters" button.

#### Detail panel

**DetailPanel**: shows the top of the `open` stack. The close button and `Esc` (when nothing nested is open) clear `open`.

**PanelHeader**:
1. **Breadcrumbs:** one per stack entry. Show the last 3 and put earlier ones in an overflow "…" menu. A back arrow pops one entry.
2. **Title row:** swatch, name (h2), id in monospace with a copy button (shown when it differs from the name), and ServerOnlyBadge. Actions on the right: PinButton, CopyRecipeButton and close.
3. **Meta line:** group or category, and for reagents the physical description ("translucent") in muted text.
4. A 3px accent bar in the reagent's colour along the top edge.

**Tabs** (Radix Tabs, synced to `tab`):
- Labels carry counts where useful ("Used in 4").
- `1`–`5` switch tabs while the panel has focus.
- A tab with no content is hidden, not shown empty: no Calculator for `reaction` subjects, no Sources unless the item has grind or juice output.

**RecipeTab**:
- **VariantSwitcher**, shown when there are several producers: a segmented control labelled "Recipe 1 of 2", with each option named after its reaction id or device. It syncs to `via`.
- **ReactionCard:**
  - Reactant lines: AmountText, ReagentLink. Catalyst lines get a dashed outline and the label "catalyst · not consumed".
  - A divider with ▼, then the products: the primary product in bold, and other products under the label "also makes".
  - ConditionChips row.
  - Effects (only when `effects` is non-empty): a collapsible "Effects" list with one line per effect: its `_type` in human form ("Flash reaction effect"), then its other keys as `key: value`.
- **CookingCard:**
  - Device and time chips.
  - "Solids" lines: "1×", EntityLink.
  - "Reagents" lines: AmountText, ReagentLink.
  - The result item.
  - A "secret recipe" chip when `secret` is set.
- **Basic reagent (no producer):** a callout "Basic reagent — not made by any reaction". Below it, a "Where to get it" list from `sourcesOf` ("Grind a wheat bushel → 10u flour"). With no sources, the line "No known source in this data".
- **Description:** `desc` in a muted paragraph.

**TreeTab** (IngredientTree): an ARIA tree.
- **Root:** the subject at one batch of its selected variant, or at the calculator amount when `amt` is set (the header shows "for 30u").
- **Nodes:** AmountText, link, and a kind icon. Children are the reactants (or solids and reagents) of the node's selected variant.
- **Node markers:**
  - Catalyst nodes are marked and collapsed by default.
  - Basic leaves show a source hint ("grind: wheat bushel").
  - A node that would repeat an ancestor shows "↻ cycle" and has no children.
  - Nodes with several producers show a small variant picker. The choice is shared with the calculator through `v.<id>`.
- **Controls:** expand all and collapse all. The tree is expanded 2 levels by default, and deeper nodes render lazily. Indentation guides are 16px per level.
- **Acceptance:** a 3-level drink renders every level; the cycle marker stops infinite expansion.

**CalculatorTab**: a UI over `plan()` from `@ss14help/calc` (Phase 5). No arithmetic happens in components.
- **Input row:** an AmountInput (number, min 0.01, step 1, unit suffix "u", or "×" for items) plus preset buttons 10 / 30 / 50 / 100. It syncs to `amt`. Invalid input shows an inline error and keeps the last valid result.
- **Options:**
  - "Treat as owned": a multi-select of the intermediates in the current plan. Selected ones become leaves.
  - Variant pickers: the same as the tree.
- **Results**, in this order:
  1. **Shopping list:** a table of basic reagents, solids and catalysts with total amounts and source hints, and a "Copy as text" button.
  2. **Catalysts:** "keep at least 1u Plasma in the beaker".
  3. **Byproducts / leftovers.**
  4. **Steps:** a numbered list of instructions. Each step has its ConditionChips and a checkbox for ticking it off in game; tick state is not persisted.
  5. A notice for quantized overshoot ("makes 32u, 2u extra").
- **Number format:** at most 2 decimals with trailing zeros trimmed (`1.5u`, `10u`), matching the game's 0.01u fixed point.
- **Acceptance:**
  - With `schema/examples`, 30u Bicaridine → 15 batches: 15u Inaprovaline (5 batches of its own recipe) and 15u Carbon. Shopping list: 5u Oxygen, 5u Sugar, 20u Carbon, and 1u Plasma listed as a catalyst, not scaled. Steps also say "heat to ≥ 370 K" and "centrifuge".
  - Changing `amt` updates the results within one frame for typical recipes.

**UsedInTab**: everything that consumes the subject.
- Groups: "Ingredient in" (reactions), "Catalyst for" and "Used in cooking", each sorted by name. Rows reuse ReactionRow and CookingRow.
- Clicking a row pushes that product or item onto the stack.

**SourcesTab** (items only): what grinding or juicing this item yields, as AmountText and ReagentLink lines under "Grind" and "Juice" headings.

#### Primitives

| Component | Spec |
|---|---|
| **ReagentSwatch** | A 12px circle (16px in headers) filled with `color`. It has a 1px border at 30% foreground so light colours stay visible. When `color` is null, show a diagonal-hatch pattern. Decorative: `aria-hidden`. |
| **ReagentLink / EntityLink** | A button styled as a link: swatch (or item icon) and name. Click pushes onto the stack. A HoverCard after 400ms (desktop only) shows the name, desc, and a one-line recipe summary. Unknown ids render as plain monospace text with the tooltip "Not in data" and no link. |
| **AmountText** | Formats a number as described above and adds the unit (`u`, `×`, `s`, `K`) after a thin space. Uses `tabular-nums` so amounts align in columns. |
| **ConditionChip** | Variants: `heat` "≥ 370 K" (tooltip "97 °C"), `cold` "≤ 300 K", `mixer` "Centrifuge" (several mixers: "Centrifuge + Electrolysis" — the mixer must support all of them), `catalyst`, `device` "Microwave", `time` "10 s" or "instant", `quantized` "whole batches", `secret`, and `priority` (only when > 0, with a tooltip explaining reaction order). Each has an icon, text and tooltip. Colour is never the only signal. |
| **ServerOnlyBadge** | "Starlight only", using the server's name. Rendered only when `serverOnly` is set. |
| **PinButton** | A ★ toggle with `aria-pressed`, shortcut `p`, and a toast "Pinned" / "Unpinned". |
| **CopyRecipeButton** | Copies plain text such as `Bicaridine: 1u Inaprovaline + 1u Carbon (catalyst: 1u Plasma), ≥370K, centrifuge → 2u`. |
| **Kbd** | Renders shortcut hints, switching `⌘` and `Ctrl` by platform. |
| **KeyboardHelp** | A dialog listing the keyboard map below. |

### 3.5 Keyboard map

| Key | Scope | Action |
|---|---|---|
| `⌘K` / `Ctrl K` / `/` | Global | Open the command palette |
| `j` / `k`, `↓` / `↑` | List | Move focus |
| `Enter` | List / palette | Open the subject |
| `p` | List row, panel | Pin or unpin |
| `1`–`5` | Panel | Switch tabs |
| `Backspace` / `Alt ←` | Panel | Pop the stack |
| `Esc` | Any | Close the palette, then the hover card, then pop the stack, then close the panel |
| `g` then `s` | Global | Focus the sidebar tree |
| `?` | Global | Keyboard help |

Shortcuts are ignored while typing in an input, except `Esc` and `⌘K`.

### 3.6 Visual design

- **Theme:** dark first, plus light and system. Tokens are CSS variables on `:root` and are redefined for dark mode, mapped into Tailwind with `@theme`:
  - `--bg`, `--bg-elevated`, `--bg-muted`, `--fg`, `--fg-muted`, `--border`, `--accent` (one brand hue, e.g. a chem-lab teal), `--warning`, `--danger`
  - chip tints: `--heat`, `--cold`, `--catalyst`, `--server-only`
- **Type:** Geist Sans for UI and Geist Mono for ids and amounts (both already in the scaffold). Base size 14px with dense line height. Panel titles are 18px/600.
- **Reagent colours:** used only in swatches and the panel-header accent bar. They are never used as text or background colour for content, because they are arbitrary and often low contrast.
- **Density:** 8px spacing grid. Rows are 40px. The panel has 16px padding.
- **Motion:** sheet and drawer slides of 150–200ms. Everything respects `prefers-reduced-motion` (no slides, instant tab changes).
- **Contrast:** all text meets WCAG AA in both themes. Chips meet 3:1 against their background.

### 3.7 Accessibility checklist

- [ ] Landmarks: `header` (TopBar), `nav` (Sidebar), `main` (list), `aside` (panel, labelled with the subject name).
- [ ] The sidebar tree and ingredient tree follow the WAI-ARIA tree pattern. The panel tabs follow the tabs pattern.
- [ ] Focus is moved to the panel title on open and returned to the originating row on close. Dialogs and sheets trap focus.
- [ ] Every icon-only button has an `aria-label`. Condition icons in rows have screen-reader text.
- [ ] Virtualized list rows expose `aria-setsize` and `aria-posinset`.
- [ ] A visible focus ring on everything (`:focus-visible`), with no outline removal.
- [ ] Usable at 200% zoom and at 320px width.
- [ ] `prefers-reduced-motion` and `prefers-color-scheme` are respected.

### 3.8 States

- **Unknown subject in URL** (removed or wrong server): the panel shows "Not found on Starlight", with up to 5 search suggestions for the id and a button to switch to a server where it exists.
- **Snapshot older than 14 days:** DataVersionBadge turns amber, plus a dismissible banner under the TopBar.
- **Storage unavailable:** pins and recents work for the session only, and a one-time toast says so.
- **No JS:** the SSG subject pages still render the recipe content (Recipe tab only) for crawlers and link previews.

### 3.9 UI acceptance scenarios (become Playwright tests in Phase 6)

1. Open `/upstream`, press `⌘K`, type `bica`, press `Enter` → the panel shows Bicaridine; the URL has `open=reagent:Bicaridine`.
2. In the panel, click Inaprovaline → the breadcrumbs show "Bicaridine › Inaprovaline". Browser Back → Bicaridine again.
3. Calculator tab, type `30` → the shopping list matches the calc engine's fixture. Reloading the URL restores the same view.
4. Press `p` → Bicaridine appears under Pinned. Reload → it is still pinned.
5. Switch to Starlight while viewing a reagent that exists there → the same reagent stays open. One that doesn't exist → toast, and the panel closes.
6. At 375px width: the list fills the screen, tapping a row opens the bottom sheet, and swiping down closes it.
7. Chemistry › Medicine with the "Heat" filter → only reactions with `minTemp` are shown, and the count reads "n / 57".

**Exit criteria:** this spec is accepted as the reference for Phase 6, with no open layout questions. The calculator flow is worked through on paper for one real 3-level recipe.

---

## 4. Phase 2 — Data contract

**Goal:** one source of truth for the data shape, shared by the Python and TS code.

- [x] Pydantic v2 models in `pipeline/src/ss14help_pipeline/models.py`. JSON keys are camelCase, and every field is always written (`null` rather than missing):
  - `Reagent`: `id`, `name`, `desc`, `physicalDesc`, `group`, `color`, `dispensable` (added in 1.1.0), `sourceFile`, `serverOnly`.
  - `Entity` (added): `id`, `name`, `desc`, `sourceFile`, `serverOnly`. It gives display names for cooking solids, results and source items, which are entities, not reagents.
  - `Reaction`:
    - `id`, `category` (added, for the sidebar tree), `reactants: {id: {amount, catalyst}}`, `products: {id: amount}`
    - `minTemp`, `maxTemp`, `mixers[]`, `quantized`, `priority`
    - `effects[]`, kept as an opaque `{_type, ...}` and shown as text only.
  - `CookingRecipe`: `id`, `name`, `device` (default `Microwave`), `time`, `solids{}`, `reagents{}`, `result`, `group`, `secret`.
  - `Mixer` (added): `id`, `name`, used for the mixer chip labels.
  - `Source`: `entity` (its name lives in `entities.json`), `grind{}`, `juice{}`.
  - `Manifest`: `schemaVersion`, `server`, `serverName`, `repo`, `branch`, `sha`, `commitDate`, `generatedAt`, `counts{}`, `warnings[]` (`{code, message, sourceFile}`).
  - Snapshot files: `manifest.json`, `reagents.json`, `entities.json`, `recipes.json` (`reactions`, `cooking`, `mixers`), `sources.json`.
- [x] `uv run ss14help-pipeline schema` exports `schema/ss14help.schema.json`. `pnpm --filter @ss14help/schema generate` writes the TS types (`json-schema-to-typescript`). `make schema` runs both. The CI `contract` job fails if either output is stale.
- [x] Schema versioning: `SCHEMA_VERSION` (semver) is in `models.py` and is exported to TS. `@ss14help/schema` provides `isCompatibleSchemaVersion` and `assertCompatibleSchemaVersion`, which reject a different major version.
  - [ ] Call `assertCompatibleSchemaVersion` from the web build's data loader once it exists (Phase 6).
- [x] Hand-written examples are in `schema/examples/`. pytest checks that they validate and round-trip unchanged (so they're canonical) and that their references resolve. `tsc` type-checks them against the generated types (`packages/schema/src/examples.check.ts`).

Notes for Phase 3:
- `category` is the reaction file's stem. Generic stems (e.g. Starlight's `_Starlight/Recipes/reactions.yml`) need a fallback: use the primary product's reagent `group`, lower-cased.
- `serverOnly` is set by comparing ids with the upstream snapshot. Upstream items are always `false`.
- `dispensable`: walk entities with a `ReagentDispenser` component (chem, booze, soda, and fork dispensers such as `_Starlight/.../coffee_dispenser.yml`). Their `EntityTableContainerFill` lists jug/bottle entities (e.g. `JugCarbon`); each jug's solution names the reagent. Note that commented-out jugs (`# - id: JugCarbon`) are not in the dispenser.
- `Reaction.mixers`: the engine requires a mixer that supports *all* listed categories (`ChemicalReactionSystem.CanReact`).

**Exit criteria:** hand-written sample data validates in Python *and* type-checks in TS. ✅

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

Game rules it follows (verified in `Content.Shared/Chemistry/Reaction/ChemicalReactionSystem.cs`):
- A reaction runs `min(reactant / coefficient)` times over its **non-catalyst** reactants, consumes `times × coefficient` of each and makes `times × amount` of every product.
- **Catalysts** never limit or get consumed. They only need to be present; for **quantized** reactions at least their coefficient.
- **Quantized** reactions run a whole number of times (rounded down in game, so the planner rounds batches **up** to make enough).
- A mixer must support **all** of a reaction's `mixers` categories.

- [x] `RecipeGraph` (`src/graph.ts`): indexes one server's data once.
  - `producers`, `consumersOf` (ingredient / catalyst / cooking), `sourcesOf` (grind/juice hints), `stepCount` (for "Simplest first"), names.
  - A reaction that also consumes its product isn't counted as a way to make it.
  - `defaultProducer`: none for dispensable reagents (they're basic even if a split reaction makes them, e.g. Water from `BloodBreakdown`); otherwise primary-product recipes first, then fewest steps, then highest priority, then id.
- [x] `plan(graph, target, amount, { variants, owned })` (`src/plan.ts`), for reagents (u) and items (counts, via cooking recipes):
  - Resolves one producer per node (DFS; cycle-closing edges are cut and reported), then propagates demand consumers-first so shared intermediates are aggregated.
  - Scales by the yield of the **target product**, not the first product (v1 bug).
  - **Catalysts:** listed once with their coefficient, never scaled (v1 bug); `strict` when a quantized reaction needs them.
  - **Multi-product reactions:** other products go to a surplus pool. Surplus is **credited** to a later need only if its step can run before every consumer of that need (ordering edges are added); otherwise it's reported in `leftovers`.
  - **Quantized reactions and cooking:** whole batches, overshoot reported (`produced`, `overshoot`, leftovers).
  - **Variants:** `variants: { [id]: recipeId }` overrides per node (unknown ids → warning, default used). **Owned:** `owned: [ids]` stops expansion (never the target).
- [x] Outputs: `basics` (aggregated, with `reason` dispensable/basic/owned/cycle and grind/juice `sources`), `catalysts`, `leftovers`, `credits`, `steps[]` (topologically ordered, structured fields plus `text` such as "Mix 11.25u hydrogen + 3.75u nitrogen, heat to ≥ 370 K → 15u ammonia"), `tree` (per-path amounts, catalysts as leaves, `alternatives` for variant pickers), `warnings`.
- [x] Exact arithmetic: bigint rationals (`Q`) internally; inputs rounded to 0.01u like FixedPoint2; `formatAmount` rounds to 2 decimals only for display.
- [x] Vitest (`pnpm --filter @ss14help/calc test`):
  - 16 hand-verified plans on real reactions copied from the prototypes (`src/fixtures.ts`), each with the arithmetic in a comment: up to 4 levels deep (Sedin, Desoxyephedrine), catalysts (Dexalin, Leporazine, RobustHarvest), multi-product (BloodBreakdown), quantized (FlashFreezeIce), owned, dispensable; plus synthetic cases for variants, credits, cycles, strict catalysts and cooking.
  - Property tests (fast-check) on random recipe graphs: every plan is **executable** (simulating its steps from only its basics and catalysts always works and yields at least the request), scaling is linear without quantized/byproducts, catalysts never scale. A mutation check confirmed the executability property catches bad credit ordering.

Known simplifications (revisit with real data in Phase 3/7):
- Surplus is pooled per reagent, so a byproduct can't be offered to some consumers of a reagent but not others; it is then just reported as leftover.
- The plan doesn't model reactions that would fire unintentionally when ingredients are mixed together (e.g. a basic pair that reacts on its own); steps are per recipe.
- Game-side rounding of fractional reactions to 0.01u per step isn't simulated; exact values are shown rounded.

**Exit criteria:** for 15 hand-verified recipes, including 3 or more levels deep, catalysts, multi-product and quantized ones, the engine's output matches manual calculation. ✅

---

## 8. Phase 6 — Frontend build

**Goal:** implement the Phase 1 design on top of the data and the calc engine.

- [ ] Routing, URL state and storage exactly as specified in Phase 1 §3.3. `/[server]/reagent/[id]` and `/[server]/item/[id]` are statically generated (`generateStaticParams`) for SEO and deep links.
- [ ] Components as specified in Phase 1 §3.4; acceptance scenarios §3.9 become the Playwright suite.
- [ ] Load data at build time from `data/<server>/`, and check `schemaVersion` there.
- [ ] Search: MiniSearch from the prebuilt `search-index.json`, with fuzzy and prefix matching over names, ids and aliases.
- [ ] Extras: a copy-as-text recipe button, a server-only badge, a stale-data banner when the snapshot is more than 14 days old, and a data-version footer that links to the changelog.
- [ ] Quality:
  - Lighthouse ≥ 90 for performance and accessibility.
  - Playwright smoke tests: search, open the panel, drill into an ingredient, calculate, pin, switch server.

**Exit criteria:** the full flow works on the upstream data in production, on desktop and on mobile.

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
