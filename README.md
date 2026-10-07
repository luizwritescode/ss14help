# ss14help

A crafting and chemistry guide for [Space Station 14](https://spacestation14.com/) that covers
several servers. Recipe data is generated straight from each server's game repository, so the guide
matches what is actually in the game.

**Live site: [ss14help.vercel.app](https://ss14help.vercel.app)**

## What it does

- **Browse and search** every chemical reaction, reagent, cooking recipe and grind/juice source of a
  server. Press `Ctrl K` (`⌘K` on Mac) to search, or browse by category in the sidebar.
- **Recipe details**: ingredients, products, catalysts, temperature limits, required mixers
  (centrifuge, electrolysis, …), cooking device and time, and reaction effects.
- **Ingredient tree**: expand a recipe down to its basic, dispensable or grindable ingredients.
- **Calculator**: ask for an amount (e.g. `30u bicaridine`) and get a shopping list, the catalysts to
  keep in the beaker, leftovers, and numbered steps in the order to do them. The math is exact and
  follows the game's own reaction rules, including catalysts, multi-product reactions and
  whole-batch (quantized) reactions.
- **Used in**: every reaction or dish an ingredient goes into.
- **Several servers**: switch between servers from the top bar. Content that only exists on a fork
  is marked as such.
- **Shareable state**: the URL holds what is on screen, so any view can be linked. Pins and recent
  items are saved in your browser.

Supported servers today:

| Server                  | Game repository                                                                     | Branch          |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------- |
| Wizard's Den (upstream) | [space-wizards/space-station-14](https://github.com/space-wizards/space-station-14) | `master`        |
| Starlight               | [ss14Starlight/space-station-14](https://github.com/ss14Starlight/space-station-14) | `starlight-dev` |

ss14help is an unofficial fan project, not affiliated with the Space Wizards Federation or any
server. See [ATTRIBUTION.md](ATTRIBUTION.md).

## How it works

There is no database and no backend at runtime. The project has two halves:

1. A **Python pipeline** reads a server's game files (the YAML prototypes in `Resources/Prototypes`
   and the English text in `Resources/Locale/en-US`), resolves inheritance and localization the same
   way the game engine does, and writes a validated snapshot of JSON files to `data/<server>/`.
2. A **Next.js web app** reads those snapshots at build time and is deployed as a static site. All
   searching and calculating happens in the browser.

```
game repo (GitHub)                  pipeline (Python)                    web app (Next.js)
Resources/Prototypes/*.yml  ──►  fetch · parse · resolve · localize  ──►  data/<server>/*.json  ──►  static site
Resources/Locale/en-US/*.ftl     normalize · validate · emit                                         on Vercel
```

Each snapshot records the exact commit it was built from in `manifest.json`, and the site shows that
commit and its age in the top bar.

## Repository layout

| Path              | What                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `apps/web`        | Next.js frontend (App Router, TypeScript, Tailwind)                            |
| `packages/calc`   | Calculator engine in plain TypeScript, no UI. Exact rational arithmetic        |
| `packages/schema` | TypeScript types for the data, generated from the pipeline's models            |
| `pipeline`        | Python data pipeline (uv, Pydantic), plus its Dockerfile                       |
| `schema/`         | JSON Schema exported from the pipeline models, and small hand-written examples |
| `data/<server>`   | Generated data snapshots, committed to the repo. Don't edit by hand            |
| `servers.yaml`    | The list of supported servers                                                  |
| `docs/`           | Operational notes (Vercel setup)                                               |
| `ROADMAP.md`      | Design notes, the UI spec and the project plan                                 |

## Running it locally

### Requirements

- [Node.js](https://nodejs.org/) 22 or newer
- [pnpm](https://pnpm.io/) 10. The easiest way is `corepack enable`, which picks up the version
  pinned in `package.json`
- [uv](https://docs.astral.sh/uv/), only if you want to run the data pipeline. It installs Python 3.12
  for you
- [Git](https://git-scm.com/)
- Optional: GNU Make (for the shortcuts below) and Docker

### Just the website

The data snapshots are committed, so you don't need the pipeline to run the site.

```sh
git clone https://github.com/luizwritescode/ss14help.git
cd ss14help
pnpm install
pnpm dev
```

Then open <http://localhost:3000>. `pnpm dev` copies `data/` into the web app before it starts.

> Development currently happens on the `v2` branch. If it isn't the default branch yet, run
> `git checkout v2` after cloning.

### Rebuilding the data

To regenerate a snapshot from the latest commit of a server's game repository:

```sh
cd pipeline
uv sync
uv run ss14help-pipeline servers            # list the servers in servers.yaml
uv run ss14help-pipeline build upstream     # or: build starlight
```

The pipeline does a shallow, sparse clone of only the folders it needs (about 30 MB per server,
cached in `pipeline/.cache/`) and takes around 10 to 20 seconds. Build `upstream` before other
servers: fork snapshots are compared against it to mark server-only content.

Other options:

```sh
uv run ss14help-pipeline build upstream --source /path/to/space-station-14   # use a local checkout, no network
```

Or with Docker, from the repo root:

```sh
docker build -f pipeline/Dockerfile -t ss14help-pipeline .
docker run --rm -v "$PWD/data:/repo/data" ss14help-pipeline build upstream
```

### Production build

```sh
pnpm build                                    # builds the packages and the static site
pnpm --filter web start                       # serve it on http://localhost:3000
```

### Make shortcuts

If you have GNU Make, these wrap the commands above:

```sh
make install   # pnpm install + uv sync
make web       # Next.js dev server
make data      # rebuild data/upstream
make schema    # re-export the JSON Schema and regenerate the TS types (after editing models.py)
make test      # Vitest + pytest
make lint      # ESLint, tsc, Prettier, Ruff, mypy
make build     # production build of the web app
make docker    # build the pipeline image
```

## Testing

```sh
pnpm test                              # Vitest: calc engine, schema, web app logic
cd pipeline && uv run pytest           # pipeline tests against a miniature game repo
pnpm build && pnpm --filter web e2e    # Playwright acceptance tests against the production build
```

The first Playwright run may ask you to install browsers with `pnpm --filter web exec playwright install`.

The pipeline tests build `pipeline/tests/fixtures/repo` (real prototype snippets) and compare the
output with `pipeline/tests/fixtures/golden/`. If you change the output on purpose, regenerate the
golden files with `UPDATE_GOLDEN=1 uv run pytest tests/test_build.py` and review the diff.

## Contributing

Issues and pull requests are welcome, whether it's a wrong recipe, a UI bug or a new feature.

- **Wrong data?** Open an issue with the server, the recipe or reagent id, and what the game files
  say. Check the commit shown in the site's top bar first, since the snapshot may be older than the
  game.
- **Before opening a PR**, run `make lint` and `make test` (or the commands they wrap). CI runs the
  same checks.
- **Changing the data shape**: edit `pipeline/src/ss14help_pipeline/models.py`, then run `make schema`
  so the JSON Schema and the TypeScript types stay in sync. CI fails if they're stale.
- **Don't edit `data/` by hand.** Change the pipeline and rebuild the snapshot instead.

### Adding a server

A server whose game files follow the standard SS14 layout only needs configuration:

1. Add an entry to [servers.yaml](servers.yaml) with an `id`, a display `name`, the `repo` URL and the
   `branch`.
2. Run `uv run ss14help-pipeline build <id>` in `pipeline/` and check the warnings in the generated
   `data/<id>/manifest.json`.
3. Check the server's license and add a row for it to [ATTRIBUTION.md](ATTRIBUTION.md).
4. Run the site and spot-check a few recipes against the game.

Forks that add new prototype types or engine features may also need pipeline changes. Starlight's
partial prototypes and extra cooking devices are examples.

### Forking

You're free to fork and host your own copy. The web app is a standard Next.js app: on Vercel, set the
project's Root Directory to `apps/web`. [docs/vercel.md](docs/vercel.md) has the details.

## License

The code is MIT licensed, see [LICENSE](LICENSE).

The game data in `data/` is generated from each server's repository and stays under that
repository's license. Starlight's license requires attribution with a link to its repository. See
[ATTRIBUTION.md](ATTRIBUTION.md) for details.
