# AGENTS.md: reglas para agentes de IA

Civora es una prueba de concepto de votación digital: web Next.js
(`apps/web`), contrato Solidity/Hardhat (`packages/contracts`) e identidad
con ZKPassport o certificado digital. **No está habilitada para elecciones
oficiales ni vinculantes.** Qué garantiza hoy: [README.md](README.md#garantías-por-requisito).

Mapa de la documentación (cada contenido vive en un único archivo; los demás
enlazan):

| Archivo | Contenido |
|---|---|
| [AGENTS.md](AGENTS.md) | Comandos, convenciones, reglas de trabajo y cierre de tarea |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases, tareas con estado, dependencias y criterios de aceptación |
| [docs/despliegue-produccion.md](docs/despliegue-produccion.md) | Contrato, variables, comprobaciones, fusión a `main` y vuelta atrás |
| [docs/despliegue-vps.md](docs/despliegue-vps.md) | DNS, Easypanel, imagen Docker y healthcheck en `civora.nexuraia.com` |
| [docs/decisiones/](docs/decisiones/README.md) | Decisiones de arquitectura (ADR) |
| [README.md](README.md) | Qué es, garantías, componentes y configuración de entorno |
| [docs/modelo-amenazas.md](docs/modelo-amenazas.md) | Amenazas, lo que no está resuelto y mitigaciones |
| [docs/auditoria-seguridad.md](docs/auditoria-seguridad.md) | Hallazgos de auditoría y verificaciones |
| [docs/especificacion-publica.md](docs/especificacion-publica.md) | Especificación funcional pública |
| [SECURITY.md](SECURITY.md) | Cómo reportar vulnerabilidades en privado |

## Comandos

Todos desde la raíz, en PowerShell. La terminal del agente no es
interactiva: instala siempre sin confirmación.

```powershell
pnpm install --frozen-lockfile --config.confirmModulesPurge=false
```

Arranque local, en tres terminales (la configuración de entorno está en
[README.md](README.md#arrancar-en-local-o-codespaces)):

```powershell
pnpm --filter @civora/contracts node              # 1. nodo Hardhat local
pnpm --filter @civora/contracts deploy:localhost  # 2. despliega el contrato
pnpm dev                                          # 3. web en http://localhost:3000
```

Verificación (deben pasar antes de dar una tarea por terminada):

```powershell
pnpm --filter @civora/contracts test
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web test:e2e
```

- `test:e2e` ejecuta Playwright + axe (WCAG 2.1 AA) a 1280 y 375 px contra
  `next build` + `next start` en el puerto 3100, con las API simuladas. La
  primera vez: `pnpm --filter web exec playwright install chromium`.
- El CI (`.github/workflows/ci.yml`) ejecuta estos cinco pasos en cada PR y
  en cada push a `main`, y además construye la imagen Docker, la arranca y
  comprueba `/api/salud` (job «Imagen Docker»). En Windows no hay que
  construir la imagen: la salida standalone solo se activa con
  `CIVORA_STANDALONE=true` dentro del Dockerfile.
- `pnpm dev` usa una CSP de desarrollo con `'unsafe-eval'`
  ([ADR 0007](docs/decisiones/0007-csp-con-nonce.md)); no la uses para
  validar la CSP de producción.

Despliegue en Sepolia y comprobación del contrato desplegado (variables y
orden en [docs/despliegue-produccion.md](docs/despliegue-produccion.md)):

```powershell
pnpm --filter @civora/contracts deploy:sepolia
pnpm --filter @civora/contracts verificar:sepolia
```

## Convenciones

- Español de España en código de dominio, interfaz, documentación y commits.
- Commits en Conventional Commits, en español (`feat:`, `fix:`, `docs:`,
  `test:`, `refactor:`).
- TypeScript estricto, sin `any` injustificado. La lógica pura del cliente
  va en `apps/web/lib/*.mjs` para probarla con `node --test`.
- Accesibilidad: todo cambio en el flujo de voto mantiene WCAG 2.1 AA y su
  comprobación con axe en `apps/web/e2e`.
- Sin scripts inline: la CSP usa nonce. Medios solo del propio origen.
- Secretos solo en variables de entorno (`.env`, `.env.local`, Easypanel);
  nunca en código, documentación versionada ni commits, ni como `ARG` del
  Dockerfile. No leas ni muestres archivos `.env`.
- Registros del servidor solo con `lib/registro.mjs` (contexto fijo y
  código corto); nunca IPs, cuerpos, firmas, certificados ni nullifiers.
- Rutas dinámicas: el parámetro se lee de la URL en las API
  (`lib/parametros-ruta.mjs`) y con `useParams` en las páginas, para
  funcionar igual en Next 14 y 15.

## Reglas de trabajo

- Una rama nueva por tarea (`feat/…`, `fix/…`, `docs/…` o el nombre de la
  fase). Nunca trabajes directamente en `main`.
- Tests para cada cambio y los comandos de verificación en verde.
- **Antes de cada despliegue, `pnpm audit --prod` sin vulnerabilidades.** Si
  aparece alguna, corrígela (actualización u override en
  `pnpm.overrides` de `package.json`) o documéntala en la
  [auditoría](docs/auditoria-seguridad.md#dependencias-2026-10-06-rama-actualizar-dependencias)
  antes de desplegar. Las versiones mayores de Next y React son tareas
  propias ([ADR 0012](docs/decisiones/0012-next-15-react-19.md)).
- **`main` despliega a producción en Easypanel** (`civora.nexuraia.com`,
  [docs/despliegue-vps.md](docs/despliegue-vps.md)). No fusiones a `main`
  sin confirmación explícita del responsable y, si el cambio afecta al
  contrato, sin redesplegarlo antes y actualizar `CONTRATO_DIRECCION` y
  demás variables del servicio.
- No toques contratos ni la arquitectura de identidad fuera de la fase que
  les corresponde en el [ROADMAP](docs/ROADMAP.md).
- Respeta las decisiones de [docs/decisiones/](docs/decisiones/README.md).
  Para cambiar una, escribe un ADR nuevo que la sustituya.
- Nunca publiques el NIF ni hashes directos del DNI
  ([ADR 0005](docs/decisiones/0005-no-publicar-nif.md)).

## Cierre de tarea

1. Comandos de verificación en verde.
2. Actualiza el estado y los criterios en [docs/ROADMAP.md](docs/ROADMAP.md).
3. Añade lo revisado y verificado a [docs/auditoria-seguridad.md](docs/auditoria-seguridad.md).
4. Si has tomado una decisión de arquitectura, crea un ADR en
   [docs/decisiones/](docs/decisiones/README.md) y añádelo al índice.
5. Si cambian las garantías o las amenazas, actualiza la tabla del
   [README](README.md#garantías-por-requisito) y el
   [modelo de amenazas](docs/modelo-amenazas.md).
6. Commit en la rama de la tarea; push solo con confirmación.
