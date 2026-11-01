# Ronda 22 · T077 — Verificación documental de Fase 3 (Developer)

- Spec: 003 Disponibilidad flexible por mes.
- Alcance: solo documentación. Sin cambios de código, pruebas, migraciones ni BD. Sin commit. `tasks.md` sin tocar (T077 lo marca el Orquestador).
- Tipo de verificación: **estática** (lectura de código y documentos, búsquedas con grep). No se ejecutaron pruebas, build, lint ni navegador.
- Turnos aproximados: ~55 de 80.

## 1. Archivos modificados y secciones

| Archivo | Sección (líneas aprox. previas a la edición) | Cambio |
|---|---|---|
| `README.md` | Reglas funcionales clave, L154 (única línea tocada) | El umbral ya no dice "solo si existe separación mínima de 15 días". Ahora: varias citas permitidas; si una fecha queda a menos de 15 días naturales de una cita activa del mismo mes (`PENDING`, `CONFIRMED`, `SYNC_FAILED`), se ofrece reagendar o continuar como nueva; nunca bloquea. |
| `docs/specification.md` | 9 Concurrencia, después del párrafo del editor de reglas (~L432) | Nuevo párrafo: confirmar o rechazar una `PENDING` desde admin toma `FOR UPDATE` sobre cita y cliente, sin locks con nombre ni `FOR SHARE`; riesgo 1213 aceptado (NB-1). |
| `docs/architecture/business-rules.md` | Lock order (~L186-194) | Nuevo punto: la transición admin de `PENDING` queda fuera del orden de seis pasos; riesgo NB-1. |
| `docs/architecture/api.md` | Disponibilidad mensual y reservas, subsección Reserva pública (~L464-471) | Añadidos: `MONTH_NOT_ALLOWED` (400) en `reservar/lock`, `client-check-lock` y `confirm`; contrato D95 de `client-check-lock` (`futureAppointmentsInMonth`, `canBookAsNewAppointment`); contrato D95 de `confirm` con `appointmentIdToReschedule` (PENDING sigue PENDING, sin evento, con `MODIFIED`; CONFIRMED/SYNC_FAILED sin bitácora desde el wizard). |
| `docs/architecture/data-model.md` | Concurrencia a nivel de datos (~L209) | Nuevo párrafo sobre la transición admin de `PENDING`. |
| `docs/architecture/data-model.md` | Limitaciones conocidas de concurrencia (~L217) | Nuevo bullet: deadlock 1213 (NB-1), riesgo aceptado. |
| `docs/architecture/data-model.md` | Protecciones de integridad, nota MySQL (~L241) | Quitada la referencia interna "Q-T2 de D84"; texto autónomo: la versión mínima está pendiente de confirmar. |
| `docs/architecture/data-model.md` | Bitácora de esquema, fila 0022 (~L296) | Estado: aplicada en copia local el 2026-10-31 (T063); pendiente de despliegue en producción con la release combinada. |
| `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` | Decisión, tras la frase "Seis rutas…" (~L30) | Añadida la excepción: la transición admin de `PENDING` no es una séptima ruta del orden (ver punto 2). |
| `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` | Riesgos conocidos (~L46) | Añadido NB-1 como riesgo residual aceptado por el owner (según el brief). |
| `docs/features/booking-flow.md` | Error scenarios (~L215) | "Fecha fuera de reglas (fin de semana o slot pasado…): rechazo" → día sin horarios ofrecibles, `SLOT_NOT_AVAILABLE` (D46), como indica `api.md`. |
| `docs/ui/admin/components.md` | `WeeklyOccupancyCard`, "No debe" (~L298) | "incluir sábados o domingos" → omitir sábados/domingos está prohibido; el gráfico muestra lunes a domingo (D57). La UI actual sigue con 5 columnas (`components/admin/ui/WeeklyOccupancyCard.tsx:100`, Fase 4). |
| `docs/ui/admin/components.md` | `DailyOccupancyCard`, Rules (~L376) | "usar capacidad diaria 3" → `maxPerDay` si el día está abierto, `0` si está cerrado o con bloqueo de día completo (D44, D53). Coincide con `lib/admin/dashboard/service.ts:381`. |
| `docs/ui/admin/components.md` | `AvailabilityEditorModal`, Descarte (~L953) | Scrim: decidido tokenizar sin cambiar color (D105b); el token todavía no existe en `app/globals.css`. |
| `docs/ui/admin/components.md` | Calendario de `MonthDetailView` (~L1211) | Lista de tonos: `available`, `low`, `full`, `closed` (no `weekend`) e `isWeekend`. Coincide con `lib/admin/months/types.ts:55`. |
| `docs/ui/admin/design-system.md` | Semántica de color para disponibilidad diaria (~L366-371) | Reescrita según D105: `full` con ≥1 cita activa → verde; `full` sin citas o `closed` → gris. Coincide con `components/admin/months/MonthDetailView.tsx:145-160`. |
| `docs/ui/admin/tokens.md` | Availability (~L71-76) | Mismos criterios de D105 para `availability-full` y `availability-weekend`. Nota: el nombre `weekend` es histórico. |
| `docs/ui/admin/tokens.md` | Nueva subsección "Overlay (scrim): pendiente de tokenizar" | Valor vigente `rgba(28,25,23,0.35)` como literal; decisión D105b; no existe token en código. |

## 2. Hallazgos

### 2.1 Corregidos en documentación (con evidencia)

1. README.md:154 contradecía la spec (umbral "solo si existe separación"). Corregido.
2. api.md ~L466-468: el contrato público no documentaba D95 (`futureAppointmentsInMonth`, `appointmentIdToReschedule` con PENDING) ni `MONTH_NOT_ALLOWED`. Código: `lib/appointments/lock-reservation-slot.ts:138-223` (respuesta), `lib/appointments/book-appointment.ts:243-245,316-332` (reagendado PENDING), `lib/active-months/service.ts:44-62` y `lib/appointments/book-appointment.ts:47` (`MONTH_NOT_ALLOWED`). Corregido.
3. booking-flow.md ~L215: "fin de semana → rechazo" no coincidía con D46 ni con `api.md` (`SLOT_NOT_AVAILABLE`). Corregido.
4. components.md ~L376: "capacidad diaria 3" contradecía D44/D53 y el código. Corregido.
5. components.md ~L298: "no incluir sábados o domingos" contradecía D57 y business-rules ~L349. Corregido; la diferencia real (5 columnas) queda anotada como Fase 4.
6. components.md ~L1211: tono `weekend` no existe (`lib/admin/months/types.ts:55`). Corregido.
7. design-system.md ~L368-371 y tokens.md ~L71-75: semántica de color previa a D105. Corregido con la regla del código (`MonthDetailView.tsx:145-160`).
8. ADR 0006 ~L30: la lista "seis rutas" no mencionaba la transición admin de `PENDING`. Documentado como excepción, ver 2.2.
9. ADR 0006 y spec §9 / business-rules ~L186-194: NB-1 no estaba documentado. Añadido como riesgo residual.
10. data-model.md ~L241: "Q-T2 de D84" (referencia a un documento de trabajo). Reemplazado por texto autónomo.
11. data-model.md ~L296: 0022 "pendiente de despliegue" sin mencionar que se aplicó en copia local (T063). Precisado.
12. Lock-order de C4: no se encontraron notas "implementación pendiente" de C4 en spec, business-rules ni booking-flow (`grep` sin resultados). Sin cambios en ese punto.

### 2.2 Desviaciones respecto al brief

- **ADR 0006 L30 (checklist 8):** el brief pide añadir la transición admin de `PENDING` al listado de rutas que "respetan el orden de bloqueos". El código no lo cumple: `lib/admin/appointments/service.ts:617-655` (`transitionPendingAppointment`) solo hace `SELECT … FOR UPDATE` sobre la cita y su cliente (JOIN); no hay `GET_LOCK`, ni `FOR SHARE` de reglas, ni `lockConflictingAppointments`. Añadirla al listado sería una afirmación falsa. La documenté como excepción explícita en ADR 0006, spec §9, business-rules (lock order) y data-model. **Requiere confirmación del Orquestador.**
- **NB-1:** documentado como riesgo aceptado por el owner según el brief. La aceptación solo consta en el brief; no la he verificado en `00-decisions.md` ni en `STATE.md`. Confirmar que quede registrada.

### 2.3 Reportados, no corregidos (código o decisión fuera de la ronda)

1. **Scrim (checklist 3, D105b):** el token no existe. `app/globals.css` no define ningún `--admin-scrim` (solo los `--admin-*` de disponibilidad, superficie, texto, etc.). El literal `rgba(28,25,23,0.35)` aparece en `components/admin/ui/Modal.tsx:97`, `components/admin/ui/BottomSheetModal.tsx:87` y `components/admin/months/availability/AvailabilityEditorModal.tsx:48`. La documentación lo describe como pendiente. Implementarlo es un cambio de código: decisión del Orquestador.
2. **`MONTH_NOT_ACTIVE` (checklist 5):** solo aparece en mapeos (`app/api/admin/months/[month]/appointments/route.ts:27`, `components/admin/months/MonthDetailView.tsx:88`). Ningún módulo de `lib/` lo lanza (`lib/` usa `MONTH_NOT_ALLOWED` y `MONTH_NOT_REGISTERED`). Es mapeo muerto; no está en `api.md` y no lo he añadido. Candidato a Fase 4.
3. **Gráfico semanal con 5 columnas** (`components/admin/ui/WeeklyOccupancyCard.tsx:100`) frente a D57 (lunes a domingo). Fase 4, ya registrada en la spec ~L832.
4. **Módulo legado** `lib/availability/rules.ts` (`isWeekdayBookingDate`, `getAvailableStartSlots`, `MAX_APPOINTMENTS_PER_DAY` de `lib/constants/slots.ts:7`). Solo lo importan pruebas y el oráculo (`tests/lib/availability/fixtures/legacy-block-oracle.ts`); la producción usa `lib/availability/rules-validation.ts`. Borrado previsto en T066 (Fase 4).
5. **README.md L151-152** (no tocadas, el brief solo permite L154): "Slots base: 09:00…18:00" y "Límite diario: máximo 3 citas activas" describen el valor por defecto D6 como si fuera la regla del sistema; `maxPerDay` es por regla (1-6). Decisión del owner.
6. **Reagendado del wizard sin bitácora para CONFIRMED/SYNC_FAILED** (`lib/appointments/book-appointment.ts:316-332`: solo escribe `MODIFIED` para `PENDING`), mientras Mi cita registra todos los estados. Documentado como inconsistencia aceptada (candidata a Fase 4), sin cambio de código.
7. **Endpoints fuera de la sección 003 sin contrato en `api.md`:** `/api/admin/months/catalog`, `/api/admin/months/[month]/status`, `/api/admin/months/[month]/blocked-slots/[blockedSlotId]`, `/api/admin/appointments/[appointmentId]/{confirm,reject,cancel}`, `/api/admin/clients/*`, `/api/reservar/lock/release-beacon`, `/api/cancelar*`. Existen en `app/api`. No es alcance de 003; decisión del owner.
8. **Referencias a decisiones de trabajo:** `docs/architecture/data-model.md` (~L174, ~L182), `docs/decisions/0002` (~L6) y `0005`/`0006` citan IDs D-n del registro `specs/003-flexible-month-availability/agent-reports/00-decisions.md`, que es un área temporal. Decidir si se mantienen.
9. **Brief checklist 7 (informe de ronda):** en el texto actual de `data-model.md` ~L241 y de ADR 0002 ~L25-26 no hay referencias a informes de ronda. Lo que había era "Q-T2 de D84" (corregido en 2.1, punto 10) y la referencia D-n de 2.3, punto 8. No hubo nada que reemplazar por contenido autónomo en ADR 0002.
10. **Excepción D102 (`sileo.promise` no usado en el guardado del editor):** documentada en `components.md` (~L960). `AGENTS.md:546` exige que las excepciones de notificaciones estén documentadas en `AGENTS.md`. Decisión del owner/Orquestador.
11. **Spec ~L1049-1052** ("Estado de implementación… Fase 1/2"): lenguaje de fases en un documento de producto. No tocado.
12. **Prueba de admin PENDING:** `api.md` ~L446 dice "no hay prueba específica". Verificado por grep: no hay prueba de rechazo admin de `PENDING`. Sigue siendo cierto.

## 3. Checklist del brief

| # | Estado |
|---|---|
| 1. Notas C4 y PENDING consistentes | Hecho. No quedan notas "implementación pendiente". PENDING consistente en spec, business-rules, booking-flow, my-appointments-flow y api.md (corregido en api.md). D72 verificado en código (`lib/db/admin-appointments.ts:92-100`, lectura de reagendado admin filtra `CONFIRMED`/`SYNC_FAILED`). |
| 2. Auditoría "lunes a viernes" / 3 por día | Hecho. Las menciones restantes son el valor por defecto D6, el preset legado de `data-model.md` y ejemplos de payload. Corregidas las de `DailyOccupancyCard`, `WeeklyOccupancyCard` y booking-flow. README L151-152 reportado (2.3.5). |
| 3. Scrim, componentes | Parcial. Componentes verificados por existencia y props (`Tooltip.align`, `Switch.labelAdornment`, `BottomSheetModal.overlay`, `TimeSlotChipInput`, `AffectedAppointmentsDialog`). Scrim: token inexistente en código (2.3.1). |
| 4. README L154 | Hecho. |
| 5. Códigos y rutas de `api.md` | Hecho. Todos los códigos de `api.md` existen en el código salvo `WEEKDAY_ONLY`, que el propio documento marca como retirado. Métodos HTTP de las rutas documentadas coinciden. `MONTH_NOT_ACTIVE` no está documentado y no se emite (2.3.2). |
| 6. `data-model.md` (0022, bitácora, N4) | Hecho. Pasos de N4 verificados contra las migraciones 0014 y 0022 (default `SECOND_ONLY_MODE` previo, enum). |
| 7. Referencias a informes de ronda | No había referencias a informes en el texto actual (2.3.9). |
| 8. ADR 0006 L30 y NB-1 | Hecho con desviación (2.2). |

## 4. Bloques de verificación

**Flow Contract Check**
- UI steps updated: No (ningún paso de flujo cambió; se corrigió el contrato visual de tonos y del gráfico).
- API contract updated: Yes (`api.md`: `client-check-lock`, `confirm` con `appointmentIdToReschedule`, `MONTH_NOT_ALLOWED`).
- Validation rules updated: Yes (escenario de error de día cerrado en `booking-flow.md`; las reglas del umbral ya estaban en la spec).
- Acceptance criteria updated: No (estos documentos no tienen criterios de aceptación de flujo; el criterio ejecutable son las pruebas de integración existentes).
- docs/specification.md aligned: Yes (nota de transición admin de `PENDING` y NB-1 en §9; sin cambios de comportamiento).

**Migration Compatibility Check**
- Schema changes required: No.
- Data backfill required: No.
- Legacy compatibility required: No (sin cambios de código; el estado legado de `slot_mode` ya estaba documentado).
- Rollback strategy defined: Yes (`data-model.md` ya documenta el rollback de release y el procedimiento manual N4; verificado contra migraciones).
- Cleanup phase defined: Yes (0023 y retirada de `slotMode` como Fase 4 ya documentadas; `MONTH_NOT_ACTIVE` y `rules.ts` reportados para Fase 4).
- Integrity protections defined: Yes (sin cambios; `data-model.md` añade NB-1 como riesgo residual de concurrencia).

**Admin UI Check**
- Uses components/admin/ui: No aplica. No hay código de UI modificado; los componentes documentados existen en `components/admin/ui/` o en `components/admin/months/availability/`.
- Reused existing components: Yes (la documentación describe componentes existentes; no se creó ninguno).
- New reusable components created: No.
- Tokens respected: No. El scrim sigue como literal en tres componentes porque el token no existe en código; queda documentado como pendiente (D105b).
- design-system.md aligned: Yes (con el código actual: semántica de color D105 y nota del scrim).
- Public flow untouched: Yes (no se tocó UI pública; `booking-flow.md` y `api.md` solo recibieron correcciones documentales).

**Notification Contract Check**
- Sileo used for success/warning/error/info: Yes (verificado en `hooks/admin/months/useAvailabilitySave.ts`: `sileo.show`, `sileo.success`, `sileo.error`; sin cambios en esta ronda).
- Sileo action notifications used when applicable: Yes (no se añadieron ni cambiaron notificaciones con acción en esta ronda).
- Sileo promise notifications used when applicable: No. Excepción D102 en el guardado del editor (`useAvailabilitySave.ts:67`: no usa `sileo.promise` para el 409 de confirmación). Documentada en `components.md`, no en `AGENTS.md` (2.3.10).
- i18n applied in admin notifications: Yes (`monthsDetail.availability.notifications.saveSuccess`, verificado en el hook).
- Alternative notification systems introduced: No.

**Documentation Impact**
- Yes.
- Updated docs/specification.md: Yes (§9, nuevo párrafo de transición admin de `PENDING` con NB-1). No se tocó el flujo funcional.
- Sections affected: specification §9 (Concurrencia); business-rules "Lock order"; api.md "Reserva pública"; data-model "Concurrencia a nivel de datos", "Limitaciones", "Protecciones de integridad" (nota MySQL) y bitácora 0022; ADR 0006 (decisión y riesgos); booking-flow "Error Scenarios"; components.md (WeeklyOccupancyCard, DailyOccupancyCard, AvailabilityEditorModal, MonthDetailView); design-system "Semántica de color"; tokens (availability, nueva subsección overlay); README "Reglas funcionales clave" L154.

## 5. Lo que no verifiqué

- No ejecuté pruebas (`npm test`, `vitest`, integración), `tsc`, `eslint`, `lint:admin-i18n`, `next build` ni Playwright. Todo es verificación estática por lectura y grep.
- No verifiqué visualmente los tonos ni el scrim en navegador.
- No verifiqué dimensiones citadas en `components.md` (por ejemplo 56 px del botón `+` de `TimeSlotChipInput`, 20 px del botón de quitar) ni las etiquetas de estado de `AffectedAppointmentsDialog` en `locales/`.
- No verifiqué que el owner haya aceptado NB-1 más allá del brief (2.2).
- No leí el registro de decisiones completo; solo el texto de D105 (`specs/003-flexible-month-availability/agent-reports/00-decisions.md`, línea 143), según el brief.
- No toqué `tasks.md`, `STATE.md`, ni ningún otro archivo de `specs/`. T077 queda sin marcar.

## 6. Handoff

- Estado: T077 documental completo, con las dos decisiones abiertas de 2.2 y los hallazgos de 2.3.
- Pendiente para el Orquestador: (a) confirmar la excepción de ADR 0006 frente a la instrucción de añadir la transición admin al listado de seis rutas; (b) decidir si implementar el token de scrim (D105b, cambio de código) antes del release; (c) decidir sobre `MONTH_NOT_ACTIVE` muerto, `lib/availability/rules.ts` y `WeeklyOccupancyCard` (Fase 4); (d) confirmar que NB-1 queda registrado como aceptado; (e) decidir sobre README L151-152 y sobre las excepciones de notificaciones en `AGENTS.md`.
- Siguiente acción sugerida: revisión del Reviewer de documentación (`reviewer-docs`) sobre los archivos de la tabla del punto 1, y, si el owner lo autoriza, las rondas de C4 (cierre), F1, F2 y el release combinado.
