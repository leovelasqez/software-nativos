# Publicación en Railway — máquinas de estados, 09-11-2026

Autorización del usuario, después de la verificación local de spec 021: «Haz el despliegue en railway».

## Versión de entrega

La rama `release/state-machines-2026-11-09` reúne el incremento verificado de estados (`7af634e`) y las correcciones de acceso a Caja publicadas hasta `db5a7b8`. La integración funcional es `5b63957`. El único conflicto de merge estaba en el índice documental y se conservaron ambas secciones. No se sustituyó código de Caja por su versión anterior.

La versión combinada pasó 84 pruebas unitarias, 92 de integración, TypeScript/build y los cuatro recorridos Edge (4/4, 4,5 minutos). El primer despliegue de staging `da31eda0-9310-466e-be93-fec511fa1044`, del commit `5ee7be3`, estaba saludable y coincidía en 12 de 13 archivos; sólo difería el orden de dos rutas en `PATHS` de `sw.js` por la enumeración distinta de Windows/Linux. Se añade ordenación canónica y una prueba del script real (AC-021-06) antes de promover. No cambia el conjunto de recursos ni la política de cache/activación. La versión definitiva es el commit que contiene este ajuste y este documento.

Después de la corrección de orden, TypeScript, las 85 pruebas unitarias y build pasaron. El cambio es exclusivo de generación del archivo: el contenido del service worker y su conjunto de recursos conservan los que ya aprobaron los cuatro recorridos Edge. Las 92 pruebas de integración no tienen código de servidor nuevo que revalidar por este ajuste. La comprobación externa exige coincidencia completa de los 13 archivos, incluido `sw.js`.

El escenario E2E nuevo usa ahora el acceso directo vigente, sin exigir activación del dueño. El mapa conserva 42 familias y actualiza la preparación automática y el consentimiento de todas las ventanas para anticipar la actualización del login vacío.

El commit que contiene este documento identifica el paquete de entrega. Las comprobaciones externas y sus IDs se guardan fuera de Git en `.local/state-machines-publication.json`, junto a `.local/staging-verification.json` y `.local/production-verification.json`; esto permite que GitHub, producción y staging conserven exactamente el mismo commit, sin otro commit documental posterior al despliegue.

## Comprobaciones de origen

- Producción previa: `a1ab115b-4ffa-4cf6-962a-984db0a5ff41`, `nativos-web/production`. Salud 200, sitio configurado, 13 recursos públicos coinciden con el build de `db5a7b8` y nueve fronteras de autenticación/origen correctas. Resultado en `.local/production-before.json`.
- Staging previo: `33bcbfed-ea33-4f78-9659-4723e9822fa8`, `nativos-web/staging`; salud 200 y sitio configurado.
- La variable de habilitación real de WhatsApp está ausente en producción y no es `true` en staging. Se conserva la configuración externa y no se habilita el transporte real.
- Las migraciones 001–023 permanecen idénticas a producción. La única migración adicional es 024, previamente existente en la línea de WhatsApp: añade seguimiento de entrega y conserva los registros anteriores en modo `legacy`, que no es elegible para envío real. No modifica libros de ventas, caja o inventario.

## Validación y publicación

La versión combinada se somete a `npm run check` y los cuatro recorridos Edge de `npm run test:e2e` en secuencia; registros locales `.local/release-check.log` y `.local/release-e2e.log`. No se promueve a producción si fallan. La evidencia de la revisión inicial se conserva en [state-machines-2026-11-09.md](state-machines-2026-11-09.md).

El archivo de fuentes se crea con `git archive` desde el commit exacto y una lista explícita de código, contratos, migraciones, archivos públicos y configuración. Excluye bases, credenciales, `.env`, documentos comerciales, pruebas y dependencias locales. El manifiesto local guarda la huella de cada archivo y la del archivo original.

Primero se envía el paquete a staging. Después de confirmar estado `SUCCESS`, `/health`, sitio configurado, huellas de todos los recursos públicos y rechazos sin autenticación/origen ajeno, se publica exactamente el mismo paquete en producción. Allí se repiten esas comprobaciones y se verifica que el envío real sigue desactivado. No se realizan ventas, aperturas/cierres, cambios comerciales ni envíos externos para verificar el despliegue.

## Recuperación y límites

La nueva migración es aditiva y preserva las columnas y estados anteriores; la versión anterior permanece identificada por su deployment ID y commit. No se eliminan instalaciones ni datos del navegador y no se cambia el protocolo de sincronización. Los servicios conservan sus bases separadas; no se copian datos ni credenciales entre entornos.

La comprobación alojada usa únicamente recursos públicos y fronteras de acceso. El login, los cobros y las recuperaciones se verifican con datos sintéticos en las pruebas locales del mismo código. Hardware físico y recuperación ante pérdida de disco conservan sus pendientes operativos previos.
