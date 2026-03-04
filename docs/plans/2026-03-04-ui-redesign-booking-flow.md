# Plan de Rediseño UI del Flujo de Agendar Cita

## Resumen

Se rediseñará exclusivamente el flujo de agendar en `/citas/[month]` para alinearlo con la maquetación compartida: wizard móvil de 2 pasos, selector de calendario en modal, pantalla de confirmación previa al submit y pantalla de éxito local posterior a la reserva. No se añadirá selección de servicios ni se tocarán `/` o `/cancelar`.

El objetivo es cambiar la experiencia visual y de interacción sin alterar las reglas de negocio ya implementadas. La API actual de reserva se mantiene como base, pero la UI dejará de redirigir inmediatamente a WhatsApp y en su lugar mostrará una pantalla final con CTA “Enviar confirmación por WhatsApp”.

## Objetivo

Construir una experiencia mobile-first de agendado que:

- replique el lenguaje visual de la maquetación
- guíe al usuario en 2 pasos claros
- conserve validaciones y disponibilidad actuales
- muestre confirmación local antes de enviar
- muestre éxito local después de reservar
- mantenga el redirect a WhatsApp como acción explícita posterior

## Alcance Cerrado

### Incluido

- Rediseño de `/citas/[month]`
- Modal o sheet de calendario mensual
- Paso 1: selección de fecha, horario y captura de datos
- Paso 2: confirmación de detalles antes del submit
- Pantalla de éxito local tras reservar
- CTA final: `Enviar confirmación por WhatsApp`
- Ajustes de estilos globales necesarios para este flujo
- Tests unitarios/UI/E2E del nuevo wizard

### Excluido

- Home `/`
- Cancelación `/cancelar`
- Selección de servicios
- Persistencia de servicios en DB
- Panel administrativo
- Cambio de reglas de negocio
- Cambio de contrato backend fuera de lo estrictamente necesario para la UI

## Decisiones de Producto y UX ya cerradas

- El flujo será de **2 pasos sin servicios**
- El calendario se abrirá como **modal selector**
- La pantalla de éxito **sí entra en alcance**
- El botón `Ver mis citas` se elimina
- El CTA final será **“Enviar confirmación por WhatsApp”**
- El redirect a WhatsApp deja de ser automático y pasa a ser una acción explícita desde la pantalla de éxito

## Cambios de interfaz / contrato a considerar

### API de reserva

Se mantiene `POST /api/reservar` con la misma entrada:

```json
{
  "name": "Ana Lopez",
  "phone": "5512345678",
  "date": "2026-03-04",
  "timeSlot": "09:00"
}
```

Se seguirá aprovechando la respuesta existente:

```json
{
  "appointmentId": 123,
  "status": "CONFIRMED",
  "syncReason": null,
  "whatsappUrl": "https://wa.me/..."
}
```

### Cambio funcional en cliente

Hoy:

- submit exitoso => redirect inmediato a `whatsappUrl`

Nuevo comportamiento:

- submit exitoso => render de pantalla local de éxito
- botón principal en éxito => `window.location.assign(whatsappUrl)`

### Estado de UI adicional requerido

Definir un estado cliente para el wizard, por ejemplo:

```ts
type BookingStep = "details" | "confirm" | "success";

type BookingDraft = {
  date: string | null;
  timeSlot: string | null;
  name: string;
  phone: string;
};

type BookingSuccess = {
  appointmentId: number;
  status: "CONFIRMED" | "SYNC_FAILED";
  syncReason?: string;
  whatsappUrl: string;
};
```

## Arquitectura propuesta

### Principio general

Mantener datos críticos y disponibilidad en backend, pero reorganizar el cliente de `/citas/[month]` en un flujo de estado explícito.

### Enfoque

- `app/citas/[month]/page.tsx` sigue siendo server component dinámico
- la página hidrata un contenedor cliente nuevo del wizard
- el contenedor cliente controla:
  - paso actual
  - draft de reserva
  - visibilidad del modal de calendario
  - resultado de éxito
- la confirmación previa no vuelve a consultar backend
- el submit real solo ocurre al confirmar en paso 2

### Patrón de componentes recomendado

Separar el wizard en componentes nuevos o reestructurados:

- `components/booking/booking-wizard.tsx`
- `components/booking/booking-step-details.tsx`
- `components/booking/booking-step-confirm.tsx`
- `components/booking/booking-step-success.tsx`
- `components/booking/calendar-modal.tsx`
- `components/booking/day-pill.tsx`
- `components/booking/time-pill.tsx`

Se puede reutilizar parte de:

- `components/booking/month-view.tsx`
- `components/booking/booking-form.tsx`
- `components/booking/day-selector.tsx`
- `components/booking/time-slot-selector.tsx`

Pero la recomendación es reestructurar y no solo parchear, porque el flujo actual no modela pasos.

## Dirección visual a implementar

### Lenguaje visual

Basado en la maqueta:

- apariencia tipo app móvil contenida en una “device shell”
- fondos muy suaves, crema/gris claro
- accent terracota cálido
- serif editorial para títulos
- sans suave para cuerpo y labels
- pills grandes para días y horarios
- bordes finos, esquinas muy redondeadas
- sombras suaves y elevación contenida
- jerarquía fuerte por espaciado, no por líneas duras

### Tokens visuales

Ajustar variables globales en `app/globals.css`:

- fondo general más claro y neutro
- `--accent` cercano al terracota de la maqueta
- `--surface` más opaco y limpio
- `--border` más sutil
- `--muted` más claro
- introducir tokens extra si hace falta:
  - `--card`
  - `--shadow-soft`
  - `--shadow-button`
  - `--surface-alt`

### Reglas UX

- touch targets >= 44px
- botones principales siempre full-width en móvil
- feedback de error visible y cerca del contexto
- no depender de hover
- loading state visible en botón principal
- foco visible en inputs y botones
- evitar saltos de layout al cambiar de paso

## Flujo detallado a construir

### Paso 1: Datos de la cita

Contenido:

- encabezado:
  - `Paso 1 de 2`
  - título `Agendar Cita`
  - botón para abrir calendario modal
- resumen del mes visible
- carrusel o grid horizontal de días disponibles cercanos
- selección de horario en pills
- inputs:
  - nombre
  - teléfono
- CTA principal:
  - `Siguiente`

Comportamiento:

- si no hay fecha/hora => no avanzar
- si faltan datos => mostrar errores inline
- si todo es válido => ir a paso 2 sin llamar API

### Modal de calendario

Contenido:

- mes actual con navegación visual solo si aplica al mismo mes
- grilla del calendario
- leyenda:
  - seleccionado
  - disponible
- botón `Listo`

Reglas:

- solo mostrar días del mes activo
- días no disponibles no deben parecer seleccionables
- fines de semana y días pasados deben renderizarse como inactivos
- elegir un día actualiza el draft y cierra modal al confirmar

### Paso 2: Confirmar detalles

Contenido:

- botón volver
- `Paso 2 de 2`
- título `Confirmar Detalles`
- tarjeta resumen con:
  - fecha
  - hora
  - nombre
  - teléfono
- CTA principal:
  - `Confirmar Cita`
- CTA secundario:
  - `Editar información`

Comportamiento:

- `Editar información` vuelve al paso 1 preservando draft
- `Confirmar Cita` hace `POST /api/reservar`
- si falla API:
  - permanecer en paso 2
  - mostrar error claro
  - si el slot ya no está disponible, ofrecer volver al paso 1

### Pantalla de éxito

Contenido:

- iconografía/estado visual de éxito
- mensaje principal:
  - `Tu cita ha sido agendada exitosamente`
- subtítulo corto
- resumen de la cita
- CTA principal:
  - `Enviar confirmación por WhatsApp`
- CTA secundario:
  - `Volver al inicio`

Comportamiento:

- si `whatsappUrl` existe, el CTA principal redirige
- si el status es `SYNC_FAILED`, la UI sigue mostrando éxito de reserva pero con copy secundario discreto indicando que la reserva quedó registrada
- no auto-redirigir

## Manejo de errores y estados

### Errores de validación local

- nombre vacío o muy corto
- teléfono inválido
- fecha/hora no seleccionadas

Mostrar:

- mensajes inline por campo
- error general solo si faltan fecha/hora

### Errores backend

- `SLOT_NOT_AVAILABLE`
- `PHONE_ALREADY_BOOKED`
- `MONTH_NOT_ALLOWED`
- `LOCK_TIMEOUT`

Mapeo UX recomendado:

- `SLOT_NOT_AVAILABLE` => “Ese horario ya no está disponible. Elige otro.”
- `PHONE_ALREADY_BOOKED` => “Ya tienes una cita futura activa con este teléfono.”
- `MONTH_NOT_ALLOWED` => “Solo se puede agendar en el mes actual.”
- `LOCK_TIMEOUT` => “Hubo un conflicto temporal al reservar. Intenta de nuevo.”

### Éxito parcial

- `status = SYNC_FAILED`

Mostrar en éxito:

- reserva creada
- WhatsApp disponible
- nota secundaria: “La reserva quedó registrada. La sincronización con calendario se completará después.”

## Archivos a modificar o crear

### Modificar

- `app/citas/[month]/page.tsx`
- `app/globals.css`
- `components/booking/month-view.tsx`
- `components/booking/booking-form.tsx`
- `components/ui/button.tsx`
- posiblemente `app/layout.tsx` si hace falta soporte visual global mínimo

### Crear o reemplazar con nueva estructura

- `components/booking/booking-wizard.tsx`
- `components/booking/booking-step-details.tsx`
- `components/booking/booking-step-confirm.tsx`
- `components/booking/booking-step-success.tsx`
- `components/booking/calendar-modal.tsx`
- `components/booking/mobile-shell.tsx` o equivalente si decides encapsular el frame visual

### Tests a crear o actualizar

- `tests/app/citas-month-page.test.tsx`
- nuevo test de wizard:
  - `tests/app/booking-wizard.test.tsx`
- nuevo test de confirmación:
  - `tests/app/booking-confirm-step.test.tsx`
- nuevo test de éxito:
  - `tests/app/booking-success-step.test.tsx`
- actualizar E2E:
  - `tests/e2e/booking.spec.ts`

## Fases de implementación

### Fase 1: Sistema visual y shell del flujo

Objetivo:

- acercar look & feel a la maqueta sin alterar todavía la lógica del submit

Tareas:

- ajustar tokens globales
- definir shell móvil del flujo
- rediseñar tipografía, spacing, botones y cards
- validar responsividad en móvil/desktop

### Fase 2: Reestructurar el flujo a wizard de 2 pasos

Objetivo:

- introducir estado formal de pasos

Tareas:

- crear `BookingStep`
- mover draft de reserva a un contenedor central
- separar paso de datos y paso de confirmación
- permitir volver atrás preservando estado

### Fase 3: Modal de calendario

Objetivo:

- reemplazar la selección simple por interacción más cercana a la maqueta

Tareas:

- construir modal/sheet
- renderizar calendario del mes actual
- marcar seleccionado/disponible/inactivo
- sincronizar selección con el draft principal

### Fase 4: Pantalla de éxito local

Objetivo:

- reemplazar redirect inmediato por confirmación local

Tareas:

- capturar respuesta de `/api/reservar`
- renderizar éxito con resumen
- conectar CTA a `whatsappUrl`
- mostrar manejo de `SYNC_FAILED`

### Fase 5: Testing y pulido

Objetivo:

- asegurar que el flujo nuevo no rompe reglas ni experiencia

Tareas:

- tests unit/UI del wizard
- E2E del flujo nuevo
- revisar a11y básica y estados loading/error
- revisar copy final

## Casos de prueba obligatorios

### Unit / UI

1. El paso 1 no avanza sin fecha y horario.
2. El paso 1 no avanza con nombre o teléfono inválidos.
3. El paso 2 muestra exactamente los datos elegidos.
4. `Editar información` conserva el draft.
5. La pantalla de éxito renderiza el resumen y CTA de WhatsApp.
6. Si el status es `SYNC_FAILED`, la UI sigue mostrando reserva exitosa con nota secundaria.
7. El calendario modal no deja elegir fines de semana ni días inactivos.

### API contract / integration aware

1. Error `SLOT_NOT_AVAILABLE` se muestra sin romper el flujo.
2. Error `PHONE_ALREADY_BOOKED` se muestra en contexto.
3. Error `LOCK_TIMEOUT` se trata como conflicto retriable.
4. La respuesta exitosa mantiene `whatsappUrl` como salida consumida por la UI.

### E2E

1. Usuario entra a `/citas/YYYY-MM`, selecciona día, horario, completa datos, confirma y llega a pantalla de éxito.
2. Desde éxito, el CTA principal intenta navegar a WhatsApp.
3. Usuario vuelve del paso 2 al paso 1 y no pierde datos.
4. Si el slot deja de estar disponible, la UI muestra error y permite corregir.

## Riesgos y mitigaciones

### Riesgo 1: Mezclar rediseño con cambios de dominio

Mitigación:

- mantener fuera de alcance selección de servicios
- no tocar esquema de DB ni APIs salvo consumo UI

### Riesgo 2: Parchear demasiado los componentes actuales

Mitigación:

- introducir contenedor de wizard y componentes por paso
- reutilizar solo piezas atómicas útiles

### Riesgo 3: UX bonita pero inconsistente con reglas backend

Mitigación:

- todo dato crítico sigue saliendo del backend
- no recalcular disponibilidad compleja en cliente

### Riesgo 4: Éxito local + WhatsApp cambian expectativa del flujo

Mitigación:

- dejar copy claro
- CTA primario explícito a WhatsApp
- no redirigir automático

## Supuestos y defaults

- El flujo de servicios mostrado en tu maqueta se elimina por ahora.
- El calendario mensual es solo selector visual del mes actual, no un cambio de alcance temporal.
- La pantalla de éxito reemplaza el redirect automático.
- El botón final será `Enviar confirmación por WhatsApp`.
- La cancelación y la home quedan fuera de este rediseño inmediato.
- El calendario modal debe ser mobile-first y aceptable en desktop, sin intentar emular app nativa completa.

## Criterio de aceptación del rediseño

El rediseño se considera terminado si:

- `/citas/[month]` sigue funcionando con reglas actuales
- el flujo se percibe como wizard de 2 pasos + éxito
- la UI se alinea visualmente con la maqueta compartida
- el CTA final usa WhatsApp explícitamente
- no se rompe build, tests existentes ni integración real de reserva
- existe al menos un E2E del nuevo flujo completo

## Orden recomendado de ejecución

1. Sistema visual y shell
2. Wizard de 2 pasos
3. Modal de calendario
4. Pantalla de éxito
5. Tests y pulido
