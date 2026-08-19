FROM node:24.19.0-bookworm-slim AS node_runtime

FROM composer:2.10.2 AS composer_runtime

FROM php:8.5.9-fpm-bookworm

ARG DEBIAN_FRONTEND=noninteractive
ARG PECL_REDIS_VERSION=6.3.0
ARG PECL_IMAGICK_VERSION=3.8.1
ARG PECL_XDEBUG_VERSION=3.5.3
ARG PLAYWRIGHT_VERSION=1.62.1

COPY --from=node_runtime /usr/local/ /usr/local/
COPY --from=composer_runtime /usr/bin/composer /usr/local/bin/composer

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gosu \
        jq \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libmagickwand-dev \
        libpng-dev \
        libwebp-dev \
        libzip-dev \
        mariadb-client \
        mariadb-server \
        nginx \
        openssl \
        procps \
        redis-server \
        rsync \
        supervisor \
        unzip \
        zip \
        $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j2 \
        bcmath \
        exif \
        gd \
        intl \
        mysqli \
        pcntl \
        pdo_mysql \
        zip \
    && pecl install \
        redis-${PECL_REDIS_VERSION} \
        imagick-${PECL_IMAGICK_VERSION} \
        xdebug-${PECL_XDEBUG_VERSION} \
    && docker-php-ext-enable redis imagick xdebug \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npm install --global "@playwright/test@${PLAYWRIGHT_VERSION}" \
    && playwright install --with-deps chromium \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /root/.npm /var/lib/apt/lists/*

RUN apt-get update \
    && apt-get install -y --no-install-recommends ripgrep \
    && git config --system --add safe.directory /var/www/g7 \
    && git config --system --add safe.directory /var/www/g7/modules/jiwonpapa-page_builder \
    && rm -rf /var/lib/apt/lists/*

COPY docker/nginx/g7pb.conf /etc/nginx/conf.d/g7pb.conf
COPY docker/php/99-g7pb.ini /usr/local/etc/php/conf.d/99-g7pb.ini
COPY docker/php/g7pb-pool.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/mariadb/99-g7pb.cnf /etc/mysql/mariadb.conf.d/99-g7pb.cnf
COPY docker/redis/g7pb.conf /etc/redis/g7pb.conf
COPY docker/supervisor/g7pb.conf /etc/supervisor/conf.d/g7pb.conf
COPY docker/bin/entrypoint.sh /usr/local/bin/g7pb-entrypoint
COPY docker/bin/wait-for-install.sh /usr/local/bin/g7pb-wait-for-install
COPY docker/bin/healthcheck.sh /usr/local/bin/g7pb-healthcheck
COPY docker/bin/post-install.sh /usr/local/bin/g7pb-post-install

RUN chmod 0755 \
        /usr/local/bin/g7pb-entrypoint \
        /usr/local/bin/g7pb-wait-for-install \
        /usr/local/bin/g7pb-healthcheck \
        /usr/local/bin/g7pb-post-install \
    && install -d -o www-data -g www-data /var/www/g7 /var/www/.composer

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_HOME=/var/www/.composer \
    NODE_ENV=development

WORKDIR /var/www/g7

EXPOSE 443

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=12 \
    CMD ["/usr/local/bin/g7pb-healthcheck"]

ENTRYPOINT ["/usr/local/bin/g7pb-entrypoint"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
