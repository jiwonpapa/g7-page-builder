SHELL := /bin/bash
COMPOSE := docker compose --project-name g7pb-dev --env-file .env.docker.local -f compose.yaml

.PHONY: dev-bootstrap dev-doctor dev-build dev-up dev-install dev-deps dev-build-assets dev-sync quality-php quality-frontend quality-g7 quality-gate dev-check dev-browser-smoke dev-infra-e2e dev-product-e2e dev-e2e dev-verify dev-status dev-logs dev-shell dev-credentials dev-down dev-reset staging-doctor release-package deploy-staging smoke-staging

dev-bootstrap:
	./scripts/dev-bootstrap.sh

dev-doctor:
	./scripts/dev-doctor.sh

dev-build:
	$(COMPOSE) build

dev-up: dev-doctor
	$(COMPOSE) up -d --build
	$(COMPOSE) ps

dev-install:
	./scripts/dev-install.sh

dev-deps:
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && composer install --no-interaction --no-progress --prefer-dist && npm ci'

dev-build-assets:
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm ci && npm run build'

dev-sync: dev-build-assets
	./scripts/dev-sync-module.sh

quality-php: dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && composer check'

quality-frontend: dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm run check'

quality-g7: dev-verify
	$(COMPOSE) exec -T dev bash -lc 'cd /var/www/g7 && composer validate --no-check-publish'
	$(COMPOSE) exec -T dev bash -lc 'cd /var/www/g7 && php artisan migrate:status --no-ansi'
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && vendor/bin/phpstan analyse --autoload-file=/var/www/g7/vendor/autoload.php -c phpstan-g7.neon.dist --memory-limit=1G --no-progress'
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && vendor/bin/phpunit --bootstrap tests/Integration/bootstrap.php tests/Integration'

quality-gate: quality-php quality-frontend quality-g7 dev-product-e2e

dev-check: quality-php quality-frontend

dev-browser-smoke:
	mkdir -p output/playwright
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" dev \
		playwright screenshot --ignore-https-errors --wait-for-timeout=1500 \
		--viewport-size=1440,1000 https://g7pb.test/ \
		/var/www/g7/modules/jiwonpapa-page_builder/output/playwright/home.png
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" dev \
		playwright screenshot --ignore-https-errors --wait-for-timeout=1500 \
		--viewport-size=1440,1000 https://g7pb.test/admin/login \
		/var/www/g7/modules/jiwonpapa-page_builder/output/playwright/admin-login.png

dev-infra-e2e: dev-deps
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm run test:e2e:infra'

dev-product-e2e: dev-deps
	@test -f tests/E2E/pageBuilderLifecycle.spec.ts || { \
		echo 'MVP product E2E is not implemented: tests/E2E/pageBuilderLifecycle.spec.ts' >&2; \
		exit 3; \
	}
	$(COMPOSE) exec -T --user "$$(id -u):$$(id -g)" \
		-e NPM_CONFIG_CACHE=/tmp/g7pb-npm-cache \
		-e COMPOSER_HOME=/tmp/g7pb-composer-home \
		dev bash -lc 'cd /var/www/g7/modules/jiwonpapa-page_builder && npm run test:e2e:product'

dev-e2e: dev-product-e2e

dev-verify:
	./scripts/dev-verify.sh

dev-status:
	$(COMPOSE) ps
	$(COMPOSE) exec -T dev supervisorctl status

dev-logs:
	$(COMPOSE) logs --tail=200 -f dev

dev-shell:
	$(COMPOSE) exec dev bash

dev-credentials:
	@./scripts/dev-credentials.sh

dev-down:
	$(COMPOSE) down

dev-reset:
	@if [[ "$${CONFIRM:-}" != "RESET_G7PB_DEV" ]]; then \
		echo 'Refusing reset. Run: CONFIRM=RESET_G7PB_DEV make dev-reset'; \
		exit 2; \
	fi
	@echo 'Removing only: g7pb-dev container/network and g7pb-dev-* volumes'
	$(COMPOSE) down --volumes --remove-orphans

staging-doctor:
	./scripts/staging-doctor.sh

release-package:
	./scripts/release-package.sh

deploy-staging:
	./scripts/deploy-staging.sh

smoke-staging:
	./scripts/smoke-staging.sh
