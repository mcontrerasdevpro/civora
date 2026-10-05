# Civora: contexto de trabajo

## Qué es

Civora es una prueba de concepto de votación digital con propuestas, contratos EVM y varias vías de identidad.
La web usa Next.js; los contratos usan Solidity/Hardhat, con identidad ZKPassport o certificado digital.
**Es una PoC: no está habilitada para elecciones oficiales ni vinculantes.**

Contexto ampliado: [README.md](README.md), [docs/auditoria-seguridad.md](docs/auditoria-seguridad.md) y [docs/modelo-amenazas.md](docs/modelo-amenazas.md).

## Arranque, pruebas y despliegue

En PowerShell, instala dependencias sin confirmación interactiva:

```powershell
pnpm install --frozen-lockfile --config.confirmModulesPurge=false
```

Arranque local, en tres terminales desde la raíz:

```powershell
# Terminal 1: nodo local
pnpm --filter @civora/contracts node
```

```powershell
# Terminal 2: despliegue local
pnpm --filter @civora/contracts deploy:localhost
```

```powershell
# Terminal 3: web
pnpm dev
```

Pruebas y comprobaciones:

```powershell
pnpm --filter @civora/contracts test
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
```

Despliegue Sepolia: define `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, `ZKPASSPORT_DOMAIN`, `ZKPASSPORT_DEV_MODE=false` y `RELAYER_ADDRESS` en el entorno de contratos; ejecuta:

```powershell
pnpm --filter @civora/contracts deploy:sepolia
```

En la web configura `CONTRATO_DIRECCION`, `HARDHAT_RPC_URL`, `HARDHAT_RELAYER_PRIVATE_KEY`, `DATABASE_URL`, `ADMIN_SECRET`, `RETO_CERTIFICADO_SECRET`, `NEXT_PUBLIC_ZKPASSPORT_DOMAIN` y `NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false`. No versionar secretos. Detalles: [README.md](README.md).

## Estado

Fase 0 está completada en la rama `fase-0-seguridad`:

- Dependencias reinstaladas con lockfile congelado; Hardhat ejecuta sus tests.
- `DEV_MODE` es opt-in; producción exige dominio ZK propio y `false` explícito. La demo muestra el banner **MODO DEMOSTRACIÓN**.
- La UI y API ya no ofrecen voto manual; el contrato conserva `votarManual` para certificado y restringe esa función y la creación de propuestas al relayer inmutable.
- Certificados sin NIF se rechazan; fallo abierto OCSP no permitido en producción no local.
- `POST /api/propuestas` exige `ADMIN_SECRET`, comparación de tiempo constante y rate limit en memoria por IP.
- La aplicación oculta resultados y recibos hasta el cierre; fuentes locales con `next/font` y CSP con nonce.

Riesgos abiertos:

- El voto de certificado aún puede vincular identidad y opción en el servidor. Su nullifier público deriva del NIF; esto **no** equivale a ocultar el NIF frente a enumeración. No añadir ni conservar publicación de NIF o hashes directos del DNI; diseñar la migración dentro de la fase de identidad correspondiente.
- La cadena pública expone opción y nullifier; el bloqueo de resultados solo cubre la aplicación.
- No hay censo congelado ni deduplicación verificable común entre certificado y ZK; padrón y cinco años de residencia no se prueban. La edad de certificado es autodeclarada.
- El rate limit no se comparte entre instancias; ZKPassport y Autofirma siguen siendo dependencias de terceros.

## Hoja de ruta

1. **Spike ZKPassport:** investigar y probar deduplicación entre vías sin publicar NIF ni hashes directos de documentos; documentar límites y decisión técnica.
2. **Fase 1, Semaphore:** registro de elegibles mediante un grupo basado en censo congelado, votación con prueba Semaphore y eliminación de `votarManual`.
3. Crear la página «Intenta hacer trampa» y un script de auditoría reproducible.
4. Mejorar accesibilidad e incorporar idiomas.
5. **Fase 2, MACI:** integrar MACI y someter el sistema a auditoría externa.

## Decisiones de arquitectura

- Verificar la prueba ZK dentro del contrato: el servidor/relayer no puede inventar una prueba válida ni aceptar una inválida.
- Fijar el relayer como `immutable` en el constructor y exigirlo para crear propuestas y emitir votos de certificado; la dirección debe corresponder a la clave configurada en la web.
- No publicar NIF ni hashes directos del DNI: el espacio de búsqueda permite enumerarlos. La ruta actual de certificado aún deriva un nullifier público del NIF; resolver esa deuda mediante un mecanismo anónimo antes de uso real.
- No cambiar la arquitectura de identidad antes de Fase 1. Semaphore pertenece a Fase 1; MACI, a Fase 2.

## Dos tareas abiertas

No hay IDs de issues registrados en el repositorio ni en el historial de esta sesión. Las dos tareas inmediatas quedan descritas aquí:

1. **Spike ZKPassport y deduplicación:** comprobar qué identificadores verificables pueden compartirse entre credencial de certificado y ZK sin filtrar NIF; entregar una decisión documentada y casos de prueba, sin desplegar cambios de identidad fuera de alcance.
2. **Fase 1 Semaphore:** diseñar el alta contra un censo congelado, grupo y raíz fijados antes de votar, pruebas de pertenencia/nullifier y migración que elimine `votarManual`; añadir pruebas de integración antes de retirar la vía de certificado.

## Reglas de trabajo

- Crear una rama nueva por tarea; no reutilizar `main` para trabajo de producto.
- Añadir tests por cada cambio y ejecutar los comandos relevantes de esta guía.
- No tocar la arquitectura de identidad fuera de su fase de hoja de ruta.
- Al cerrar cada tarea, actualizar [docs/auditoria-seguridad.md](docs/auditoria-seguridad.md) y este archivo.
- No incluir secretos en código, documentación versionada ni commits.