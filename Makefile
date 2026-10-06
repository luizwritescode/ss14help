.PHONY: install web pipeline test lint build docker

install:
	pnpm install
	cd pipeline && uv sync

web:
	pnpm dev

pipeline:
	cd pipeline && uv run ss14help-pipeline servers

test:
	pnpm test
	cd pipeline && uv run pytest

lint:
	pnpm lint
	pnpm typecheck
	pnpm format:check
	cd pipeline && uv run ruff check . && uv run ruff format --check . && uv run mypy src tests

build:
	pnpm build

docker:
	docker build -f pipeline/Dockerfile -t ss14help-pipeline .
