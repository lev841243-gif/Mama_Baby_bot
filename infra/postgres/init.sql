-- Две схемы: payload (контент, Payload CMS) и app (данные мам, Drizzle).
CREATE SCHEMA IF NOT EXISTS payload;
CREATE SCHEMA IF NOT EXISTS app;
-- База GlitchTip (профиль monitoring). На уже созданном томе: docker compose exec postgres createdb -U "$POSTGRES_USER" glitchtip
CREATE DATABASE glitchtip;
