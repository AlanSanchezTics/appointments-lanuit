# Appointments La Nuit

Sistema de reservas para salón de uñas con flujo público (booking/cancelación) y panel administrativo.

## Qué resuelve

- Flujo público de reserva por mes activo (`/citas/YYYY-MM`).
- Flujo público de cancelación (`/cancelar`).
- Panel admin con autenticación, dashboard y gestión operativa de meses (`/admin/*`).
- Persistencia en MySQL como fuente de verdad.
- Sincronización espejo en Google Calendar.
- Internacionalización `es`/`en` con `react-i18next`.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- Prisma ORM + MySQL 8.4
- NextAuth v5 (auth admin)
- Vitest + Playwright

## Requisitos

- Node.js 20+ (recomendado LTS)
- npm
- Docker + Docker Compose

## Configuración local

1. Clonar repositorio e instalar dependencias:

```bash
npm install
```

2. Crear variables de entorno:

```bash
cp .env.example .env
```

3. Levantar base de datos local:

```bash
docker compose up -d
```

4. Generar cliente Prisma y ejecutar migraciones:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Iniciar entorno de desarrollo:

```bash
npm run dev
```

La app quedará disponible en `http://localhost:3000`.

## Variables de entorno

Base mínima (ver `.env.example`):

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_AUTH_PEPPER`
- `WHATSAPP_PHONE`

Google Calendar (opcional en local, recomendado en staging/prod):

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_CALENDAR_SMOKE_DATE`
- `GOOGLE_CALENDAR_SMOKE_TIME`

Nota: para `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, usa el valor en una sola línea con `\n` escapados.

## Scripts principales

### Desarrollo y calidad

- `npm run dev`: desarrollo local.
- `npm run build`: build de producción.
- `npm run start`: levantar build.
- `npm run lint`: lint general.
- `npm run lint:admin-i18n`: lint específico del admin + i18n.
- `npm run test`: tests unitarios/integración (Vitest).
- `npm run test:integration`: suite de integración con MySQL real.
- `npm run test:e2e`: suite E2E (Playwright).

### Base de datos (Prisma)

- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:status`
- `npm run prisma:deploy`
- `npm run prisma:push`

### Operación

- `npm run admin:create`: crear/actualizar usuario admin.
- `npm run calendar:smoke`: smoke test real de Google Calendar (crea y elimina evento temporal).
- `npm run locks:cleanup -- --older-than-days=7 --batch=5000`: limpieza profunda de `reservation_locks`.
- `npm run months:reconcile`: reconciliación operativa de meses activos.

## Crear usuario admin

Ejemplo no interactivo:

```bash
npm run admin:create -- --username=admin --name="Admin" --password="ChangeMe123" --status=active
```

También puede ejecutarse en modo interactivo sin argumentos.

## Rutas principales

### Público

- `/`: redirige al primer mes activo elegible o muestra indisponibilidad.
- `/citas/[month]`: entrada del flujo de reserva.
- `/citas/[month]/booking`: wizard de reserva.
- `/cancelar`: flujo de cancelación.

### Admin

- `/admin/login`
- `/admin`
- `/admin/months`
- `/admin/months/[month]`

### API (resumen)

- `/api/availability/[month]`
- `/api/reservar/client-check-lock`
- `/api/reservar/confirm`
- `/api/cancelar/buscar`
- `/api/cancelar`
- `/api/admin/*`
- `/api/auth/[...nextauth]`

## Reglas funcionales clave

- Zona horaria de negocio: `America/Mexico_City`.
- Solo se agenda en meses `ACTIVE`.
- Slots base: `09:00`, `10:00`, `13:00`, `14:00`, `17:00`, `18:00`.
- Límite diario: máximo 3 citas activas.
- Lock temporal por slot en reserva: TTL 10 minutos.
- En flujo público, un teléfono puede tener varias citas activas en el mismo mes solo si existe separación mínima de 15 días naturales.
- Cancelación web permitida solo para citas elegibles con al menos 24 horas de anticipación.
- MySQL es fuente de verdad; Google Calendar se sincroniza después del commit.

## Estructura del proyecto

```text
app/                  # Rutas UI y API (App Router)
components/           # Componentes por feature y sistema UI admin
hooks/                # Orquestación de estado/interacción por feature
lib/                  # Dominio, validaciones, DB adapters e integraciones
prisma/               # Esquema y migraciones
docs/                 # Especificación, arquitectura, flujos y runbooks
scripts/              # Scripts operativos
tests/                # Tests de integración y e2e
```

## Documentación oficial del sistema

- `docs/specification.md`: fuente de verdad funcional.
- `docs/architecture/`: contratos de arquitectura (routing, API, reglas de negocio).
- `docs/features/`: flujos funcionales (booking, cancel y admin).
- `docs/architecture/spec-driven-development.md`: politica de adopcion de Spec Kit y jerarquia documental.
- `docs/ui/admin/`: design system del panel administrativo.
- `docs/runbooks/`: operación y mantenimiento.
- `.specify/` y `specs/`: artefactos de trabajo para desarrollo guiado por especificacion.

## Notas de publicación

- Antes de publicar, valida:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Si usarás Calendar real, corre también:
  - `npm run calendar:smoke`
