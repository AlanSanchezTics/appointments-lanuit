# Admin i18n Guidelines

## Purpose

Estandarizar cómo se agrega y mantiene texto UX en el panel admin.

## Rules

- Todo texto visible del admin debe resolverse con `react-i18next`.
- No se permiten literales UX inline en `app/admin`, `components/admin`, `hooks/admin`.
- Cada clave nueva debe existir en:
  - `locales/es/admin.json` o `locales/es/admin-errors.json`
  - `locales/en/admin.json` o `locales/en/admin-errors.json`
- Errores de auth/admin:
  - backend retorna código estable,
  - frontend mapea código a clave de `adminErrors` y renderiza el texto final.

## Namespace Convention

- `admin`: copy general del panel (auth, header, dashboard, formularios).
- `adminErrors`: mensajes de error traducibles del dominio admin.

## PR Checklist

- ¿Se agregaron claves en `es` y `en`?
- ¿Se evitó texto inline?
- ¿Se mantiene fallback `es`?
- ¿Pasó `npm run lint`?
