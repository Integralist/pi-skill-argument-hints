# pi-skill-argument-hints — development tasks.
#
# `make` on its own lists the targets. `make verify` runs tests and typecheck.
# `make try` launches an interactive Pi session with the extension loaded.

.DEFAULT_GOAL := help
.PHONY: help install test typecheck verify try clean

PI ?= pi

help: ## List the available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

test: ## Run unit and cucumber test suites
	npm test

typecheck: ## Check types without emitting anything
	npx tsc --noEmit

verify: test typecheck ## Run test suite and type check

try: ## Open a pi session with this extension loaded, for a live walkthrough
	$(PI) -ne -e ./src/index.ts --skill ./fixtures/skills

clean: ## Remove temporary files
	rm -rf node_modules/.cache
