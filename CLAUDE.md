# Civora: instrucciones para Claude Code

@AGENTS.md

## Específico de Claude Code

- Lee [docs/ROADMAP.md](docs/ROADMAP.md) al empezar una sesión para saber qué fase y qué tareas están en curso.
- Consulta Context7 para las API de librerías (Next.js, Hardhat, ZKPassport, Playwright, axe) en lugar de fiarte de la memoria.
- Tras cambios de interfaz, revisa con Playwright a 375 y 1280 px además de ejecutar `test:e2e`.
- `next dev` y `next start` pueden quedarse escuchando tras parar una tarea en segundo plano: libera los puertos 3000, 3100 o 3200 antes de relanzar.
- Los cambios de más de tres archivos se proponen antes como plan breve.
