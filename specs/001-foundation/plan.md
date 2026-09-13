# Plan técnico 001 — Incremento 0

Estado: verificado el alcance delimitado del incremento 0. Autorización: mensaje del usuario del 13-09-2026, «Autorizo iniciar la implementación local del sistema conforme al plan». No incluye producción, contratación ni escrituras en Alegra.

## Incremento seleccionado

Primero pendiente: incremento 0 de la hoja de ruta. Entrega contratos de identidad/permisos y sincronización, políticas ejecutables compartidas y pruebas de dominio/contrato. REQ-001-01/02/03/04 y REQ-007-02/03/04/05. Las pruebas parciales de AC-001-01/02/03 y AC-007-02/03/06 verifican las políticas, no equivalen a API, caché o ventas integradas.

Fuera: usuarios persistidos, login, servidor HTTP/PostgreSQL, UI React, Electron/SQLite, exportaciones y cobros. AC-001-04 se programa para incremento 1. No existen datos ni código previo que migrar; la maqueta externa no se copia como aplicación.

## Diseño

DEC-001: servidor modular único y dominio TypeScript compartido, sin servicios ni colas externas. Se conserva React/TypeScript, Electron/SQLite y Node/PostgreSQL para siguientes incrementos. Este núcleo no abre red ni almacena identidades. Node 24.15.0 instalado ejecuta TypeScript; tsc comprueba tipos por separado.

Autorización por acción explícita, identidad activa y sucursal asignada; denegar por defecto. Dueño también necesita alcance explícito. Los roles son perfiles iniciales; permisos configurables mediante lista concedida sin franquear la restricción de costos. El contexto viene de autenticación confiable, nunca del body enviado por un cliente.

Costos de recetas/promedios/márgenes solo en servidor y sesión online de dueño; nunca caché compartido. Importes de compra en interfaz administrativa online de dueño/encargado autorizado. Datos públicos usan proyección de campos permitidos, no eliminación de una lista de campos secretos. Auditoría definida por contrato; escritura atómica con operaciones se implementará con persistencia.

## Contratos

[Identidad v1](contracts/identity-v1.md), [esquemas](../../contracts/identity-v1.schema.json) y protocolo compartido en [007](../007-offline-sync/contracts/sync-v1.md). JSON Schema 2020-12 cerrado y validación semántica. No hay API HTTP nueva en este incremento; OpenAPI se requiere antes del servidor del incremento 1.

## Migración y recuperación

Sin almacenamiento de negocio en este incremento. Repositorio Git local nuevo, sin remoto, conserva trazabilidad; no reemplaza respaldo. No modificar fuentes Excel/Word/Alegra. El futuro adaptador deberá aplicar contratos a cada lectura/escritura y probar rollback.

## Pruebas y operación

Node test runner: matriz roles/sucursales/acciones online-offline, expiración exacta, reloj atrasado, entrada inválida, proyección sin costos. Ajv valida esquemas. tsc estricto valida código. Datos sintéticos aislados, sin credenciales reales. Evidencia con comandos, resultados y hash Git del código comprobado. No hay cambio visual ni prueba de hardware en este incremento.

## Riesgos abiertos

Autenticación, custodia Windows, revocación real, API y persistencia se implementarán en incrementos 1/3. La política recibe una concesión ya autenticada; por sí sola no autentica usuarios ni protege un equipo comprometido. No hay decisión de negocio bloqueante para incremento 0. Fiscalidad, tasas, recetas, alojamiento e impresión quedan en sus incrementos.
