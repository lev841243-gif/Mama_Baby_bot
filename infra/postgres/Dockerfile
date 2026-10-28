# Postgres 16 + pgvector для поиска по смыслу (ТЗ 10.1, этап 3).
# Собираем поверх того же postgres:16-alpine, что был раньше (решение Льва Л8): та же ОС и та же
# сортировка строк, поэтому старый том данных подходит без pg_dump/restore. Готовый образ pgvector — на Debian.
FROM postgres:16-alpine

ARG PGVECTOR_VERSION=0.8.0

# OPTFLAGS="" — без -march=native: образ работает на любом процессоре. with_llvm=no — JIT-биткод не нужен.
RUN apk add --no-cache --virtual .build-deps git build-base \
 && git clone --branch "v${PGVECTOR_VERSION}" --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
 && make -C /tmp/pgvector OPTFLAGS="" with_llvm=no \
 && make -C /tmp/pgvector install with_llvm=no \
 && rm -rf /tmp/pgvector \
 && apk del .build-deps
