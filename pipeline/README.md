# ss14help-pipeline

Builds validated data snapshots in `data/<server>/` from the SS14 server repositories listed in
`servers.yaml`. See ROADMAP.md (Phases 2–4).

```sh
uv sync
uv run ss14help-pipeline servers                  # validate servers.yaml and list servers
uv run ss14help-pipeline build upstream           # fetch (sparse, cached in .cache/) and build
uv run ss14help-pipeline build upstream --source ../../some-checkout   # no network
uv run ss14help-pipeline schema                   # re-export schema/ss14help.schema.json
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy src tests
```

With Docker (from the repo root):

```sh
docker build -f pipeline/Dockerfile -t ss14help-pipeline .
docker run --rm -v "$PWD/data:/repo/data" ss14help-pipeline build upstream
```

## Stages

| Module | Stage |
|---|---|
| `fetch.py` | Shallow, sparse clone of `Resources/Prototypes`, `Resources/Locale/en-US` and `Resources/PartialPrototypes` (blob-filtered, cached per server) |
| `prototypes.py` | Parse every `*.yml` (libyaml, catch-all `!tag` constructor → `_type`), index by type/id (later file wins, warned), resolve `parent`/`abstract` inheritance like RobustToolbox |
| `partials.py` | Partial prototypes (Starlight): files under paths listed in `Resources/PartialPrototypes/*.yml` patch existing prototypes after everything else loads (`!Remove`, `!Clear`, `!Index:n`, `!CombineIndex:n`, `!PartialOnly`, components by `type`). Elsewhere, those tags are stripped, as the engine ignores them |
| `localize.py` | Fluent `.ftl` lookup (messages, terms, attributes, references) |
| `normalize.py` | Prototypes → contract models: reagents (+ `dispensable` from filled dispensers), reactions, cooking, mixers, referenced entities, grind/juice sources |
| `emit.py` | Validate every file against the contract and write canonical JSON (sorted keys, whole floats as ints) |
| `build.py` | Orchestration, manifest, `search-index.json`, `serverOnly` vs `data/upstream` |

Problems that don't stop a build (unparseable files, duplicate ids, unknown parents, prototypes
that fail validation) are recorded in `manifest.json` → `warnings`. Phase 4 decides which of them
halt publishing.

## Tests

`tests/fixtures/repo` is a miniature game repository built from real prototype snippets;
`tests/test_build.py` builds it and compares the output with `tests/fixtures/golden/`. After an
intended change: `UPDATE_GOLDEN=1 uv run pytest tests/test_build.py`, then review the diff.
