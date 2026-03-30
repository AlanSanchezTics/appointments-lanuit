# Deploy con Dockploy (appointments-lanuit)

Guía operativa para desplegar este proyecto (`Next.js 15 + Prisma + MySQL`) en Dockploy sin exponer secretos en el repositorio.

## Alcance

- App web (Next.js) en producción.
- Base de datos MySQL 8.4 administrada por Dockploy (o externa).
- Migraciones Prisma en despliegue.

## Prerrequisitos

1. Repositorio en Git remoto accesible por Dockploy.
2. Dominio/subdominio listo (opcional, recomendado).
3. Variables de entorno de producción definidas (no usar `.env` local en Git).
4. Credenciales reales de Google Calendar (si usarás sincronización en prod).

## Fase 1: backend y migraciones

### 1) Crear Dockerfile de producción (si aún no existe)

Dockploy trabaja mejor con imagen explícita. Crear `Dockerfile` en la raíz:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npm run prisma:deploy && npm run start"]
```

### 2) Configurar MySQL en Dockploy

Crear servicio `mysql` con:

- Imagen: `mysql:8.4`
- Volumen persistente en `/var/lib/mysql`
- Variables:
  - `MYSQL_DATABASE=appointments`
  - `MYSQL_USER=<usuario_app>`
  - `MYSQL_PASSWORD=<password_app>`
  - `MYSQL_ROOT_PASSWORD=<password_root>`
  - `TZ=America/Mexico_City`
- Command (opcional recomendado): `--default-time-zone='-06:00'`

### 3) Definir variables de entorno de la app

En el servicio de app en Dockploy, definir mínimo:

- `DATABASE_URL=mysql://<usuario_app>:<password_app>@<host_mysql>:3306/appointments`
- `NEXTAUTH_SECRET=<secret_largo_random>`
- `ADMIN_AUTH_PEPPER=<secret_largo_random>`
- `WHATSAPP_PHONE=<telefono>`

Si Calendar está activo en producción:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (en una sola línea con `\n` escapados)
- `GOOGLE_CALENDAR_ID`

## Fase 2: UI/UX flow

### 4) Crear servicio de aplicación en Dockploy

- Tipo: App desde repositorio Git.
- Build context: raíz del repo.
- Dockerfile path: `./Dockerfile`
- Puerto interno: `3000`
- Health check: `/` (o endpoint propio si agregas uno)
- Dominio: `citas.tudominio.com` (ejemplo)
- TLS/SSL: habilitado en Dockploy.

### 5) Deploy inicial

1. Lanzar primer deploy.
2. Confirmar que build termina sin errores.
3. Confirmar que el contenedor inicia y ejecuta `prisma:deploy`.
4. Verificar acceso a:
   - `/`
   - `/citas/YYYY-MM`
   - `/admin/login`

## Fase 3: pruebas y rollout

### 6) Checklist post-deploy

1. Crear/actualizar admin:

```bash
npm run admin:create -- --username=admin --name="Admin" --password="<temporal>" --status=active
```

2. Validar rutas API críticas:
   - `/api/availability/[month]`
   - `/api/reservar/client-check-lock`
   - `/api/reservar/confirm`
3. Si Calendar está activo, correr smoke test controlado:

```bash
npm run calendar:smoke
```

4. Ejecutar cleanup operativo (programado o manual):

```bash
npm run locks:cleanup -- --older-than-days=7 --batch=5000
```

## Fase 4: cleanup técnico

### 7) Endurecimiento y operación continua

1. Rotar credenciales temporales usadas en bootstrap.
2. Configurar backups automáticos del volumen MySQL.
3. Configurar alertas de caídas/restart loops.
4. Establecer flujo de deploy:
   - `main` protegida
   - deploy automático solo desde tags o merge aprobado
5. Documentar rollback:
   - redeploy de imagen anterior estable
   - restauración de backup DB si una migración rompe compatibilidad

## Estrategia de rollback mínima

1. Re-deploy de la versión anterior en Dockploy.
2. Si hubo migración incompatible, restaurar backup de DB.
3. Verificar login admin y flujo `/citas/YYYY-MM/booking`.
4. Reabrir tráfico.

## Migration Compatibility Check

- Schema changes required: Yes
- Data backfill required: No (salvo migraciones nuevas futuras)
- Legacy compatibility required: No (en este alcance)
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes (Prisma migrate + DB credentials + backups)

## Notas de seguridad

- No commitear secretos productivos en `.env`.
- Usar variables de Dockploy o gestor de secretos externo.
- Restringir acceso a phpMyAdmin en producción (idealmente deshabilitado o por IP/VPN).
