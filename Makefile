SHELL := /bin/bash
COMPOSE := docker compose --project-name g7pb-dev --env-file .env.docker.local -f compose.yaml
COORD_HARNESS := ./scripts/coord-harness.sh
PROFILE ?= mixed
BASE_REF ?= HEAD

.NOTPARALLEL:

.PHONY: coord-start coord-status coord-check coord-release task-submit task-resubmit task-restack task-integrate integration-verify integration-finish runtime-guard release-guard check-agent-policy quality-coordination dev-bootstrap dev-doctor dev-build dev-up dev-install dev-deps dev-build-assets dev-sync quality-php quality-php-coverage quality-frontend quality-g7 quality-gate dev-check dev-browser-smoke dev-infra-e2e dev-product-e2e dev-e2e dev-verify dev-status dev-logs dev-shell dev-credentials dev-down dev-reset staging-doctor release-package deploy-staging smoke-staging

coord-start:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) claim --task "$(TASK)" --paths "$(PATHS)" --areas "$(AREAS)" --profile "$(PROFILE)" --base-ref "$(BASE_REF)"

coord-status:
	@$(COORD_HARNESS) status $(if $(HISTORY),--history,)

coord-check:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) check --task "$(TASK)"

coord-release:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) release --task "$(TASK)"

task-submit:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) submit --task "$(TASK)"

task-resubmit:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) resubmit --task "$(TASK)"

task-restack:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@test -n "$(NEW_BASE_REF)" || { echo 'NEW_BASE_REF is required.' >&2; exit 2; }
	@$(COORD_HARNESS) restack --task "$(TASK)" --new-base-ref "$(NEW_BASE_REF)"

task-integrate:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@test -n "$(INTEGRATION_TASK)" || { echo 'INTEGRATION_TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) integrate --task "$(TASK)" --integration-task "$(INTEGRATION_TASK)"

integration-verify:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) verify --task "$(TASK)"

integration-finish:
	@test -n "$(TASK)" || { echo 'TASK is required.' >&2; exit 2; }
	@$(COORD_HARNESS) finish --task "$(TASK)"

runtime-guard:
	@test -n "$(TASK)" || { echo 'TASK is required for the singleton runtime.' >&2; exit 2; }
	@$(COORD_HARNESS) runtime-guard --task "$(TASK)"

release-guard:
	@test -n "$(TASK)" || { echo 'TASK is required for release.' >&2; exit 2; }
	@$(COORD_HARNESS) release-guard --task "$(TASK)"

check-agent-policy:
	@grep -Fq '<!-- policy:cleanup-approval-orchestration:v1:start -->' AGENTS.md || { echo 'Cleanup approval policy start marker missing.' >&2; exit 2; }
	@grep -Fq '요청 결과와 필수 검증을 끝내는 데 필요하지 않은 임시파일·중간 산출물 삭제는 작업 중간에 실행하거나 승인 요청하지 않는다.' AGENTS.md || { echo 'Cleanup approval deferral rule missing.' >&2; exit 2; }
	@grep -Fq '비차단 정리 승인이 없거나 응답이 지연돼도 요청 결과와 필수 검증이 끝났다면 정리를 보류한 채 완료 보고하며, 정리 승인을 기다리느라 task를 대기 상태로 남기지 않는다.' AGENTS.md || { echo 'Non-blocking cleanup completion rule missing.' >&2; exit 2; }
	@grep -Fq '<!-- policy:cleanup-approval-orchestration:v1:end -->' AGENTS.md || { echo 'Cleanup approval policy end marker missing.' >&2; exit 2; }

quality-coordination: check-agent-policy
	bash tests/Harness/coord-harness.test.sh
	npm run check:editor-acceptance
	bash tests/Harness/editor-acceptance-contract.test.sh

dev-bootstrap: runtime-guard
	./scripts/dev-bootstrap.sh

dev-doctor:
	./scripts/dev-doctor.sh

dev-build: runtime-guard
	$(COMPOSE) build

dev-up: runtime-guard dev-doctor
	$(COMPOSE) up -d --build
	$(COMPOSE) ps

dev-install: runtime-guard
	./scripts/dev-install.sh

dev-deps: runtime-guard
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && composer install --no-interaction --no-progress --prefer-dist && npm ci'

dev-build-assets: runtime-guard
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm ci && npm run build'

dev-sync: runtime-guard dev-build-assets
	./scripts/dev-sync-module.sh

quality-php: runtime-guard dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && composer check'

quality-php-coverage: runtime-guard dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e XDEBUG_MODE=coverage \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && mkdir -p output/coverage && vendor/bin/phpunit --bootstrap tests/Integration/bootstrap.php tests/UnitPhp tests/Integration --coverage-clover output/coverage/php-clover.xml --coverage-filter src && php scripts/check-php-coverage.php output/coverage/php-clover.xml'

quality-frontend: runtime-guard dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm run check'

quality-g7: runtime-guard dev-verify
	$(COMPOSE) exec -T dev bash -lc 'cd /var/www/g7 && composer validate --no-check-publish'
	$(COMPOSE) exec -T dev bash -lc 'cd /var/www/g7 && php artisan migrate:status --no-ansi'
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && vendor/bin/phpstan analyse --autoload-file=/var/www/g7/vendor/autoload.php -c phpstan-g7.neon.dist --memory-limit=1G --no-progress'
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && vendor/bin/phpunit --bootstrap tests/Integration/bootstrap.php tests/Integration'

quality-gate: quality-coordination quality-php quality-php-coverage quality-frontend quality-g7 dev-product-e2e

dev-check: quality-coordination quality-php quality-frontend

dev-browser-smoke: runtime-guard
	mkdir -p output/playwright
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" dev \
		playwright screenshot --ignore-https-errors --wait-for-timeout=1500 \
		--viewport-size=1440,1000 https://g7pb.test/ \
		/var/www/g7/modules/jiwonpapa-page_builder/output/playwright/home.png
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" dev \
		playwright screenshot --ignore-https-errors --wait-for-timeout=1500 \
		--viewport-size=1440,1000 https://g7pb.test/admin/login \
		/var/www/g7/modules/jiwonpapa-page_builder/output/playwright/admin-login.png

dev-infra-e2e: runtime-guard dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm run test:e2e:infra'

dev-product-e2e: runtime-guard dev-deps
	@test -f tests/E2E/pageBuilderLifecycle.spec.ts || { \
		echo 'MVP product E2E is not implemented: tests/E2E/pageBuilderLifecycle.spec.ts' >&2; \
		exit 3; \
	}
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm run check:editor-acceptance && npm run test:e2e:product'

dev-e2e: dev-product-e2e

dev-verify: runtime-guard
	./scripts/dev-verify.sh

dev-status: runtime-guard
	$(COMPOSE) ps
	$(COMPOSE) exec -T dev supervisorctl status

dev-logs: runtime-guard
	$(COMPOSE) logs --tail=200 -f dev

dev-shell: runtime-guard
	$(COMPOSE) exec dev bash

dev-credentials: runtime-guard
	@./scripts/dev-credentials.sh

dev-down: runtime-guard
	$(COMPOSE) down

dev-reset: runtime-guard
	@if [[ "$${CONFIRM:-}" != "RESET_G7PB_DEV" ]]; then \
		echo 'Refusing reset. Run: CONFIRM=RESET_G7PB_DEV make dev-reset TASK=<integration-id>'; \
		exit 2; \
	fi
	@echo 'Removing only: g7pb-dev container/network and g7pb-dev-* volumes'
	$(COMPOSE) down --volumes --remove-orphans

staging-doctor:
	./scripts/staging-doctor.sh

release-package: release-guard
	./scripts/release-package.sh

deploy-staging: release-guard
	./scripts/deploy-staging.sh

smoke-staging: release-guard
	./scripts/smoke-staging.sh
