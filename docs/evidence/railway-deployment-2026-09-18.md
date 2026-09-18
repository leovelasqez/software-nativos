# Despliegue Railway — 18-09-2026

## Alcance ejecutado

- Proyecto Railway `nativos`, ambiente `production`.
- Servicio Node/Fastify `nativos-web` y PostgreSQL administrado `Postgres`, ambos con una sola réplica en la misma región de Railway (`sfo`, California).
- Dominio HTTPS: `https://nativos-web-production.up.railway.app`.
- `DATABASE_URL` se referencia como variable de Railway; PostgreSQL permanece en la red privada y no se habilitó un proxy TCP público.
- El arranque ejecuta las migraciones idempotentes y sirve el artefacto Vite desde el mismo proceso. El contenedor escucha el `PORT` asignado por Railway.
- No se copiaron `.local`, archivos `.env`, respaldos, evidencias ni datos comerciales locales. La base alojada inició limpia.

## Verificación técnica

Ejecutada el 18-09-2026, aproximadamente a las 03:25 America/Bogota:

- Build Railpack con Node 24.20.0: correcto.
- Despliegue de `nativos-web`: `SUCCESS`.
- Despliegue de `Postgres`: `SUCCESS`.
- `GET /health`: HTTP 200 y `{"ok":true}`; este chequeo consulta PostgreSQL.
- `GET /api/status`: `{"setupRequired":true}`, confirmando base nueva sin dueño ni copia de datos locales.
- `GET /` y `GET /caja`: HTTP 200.
- Log de arranque: proceso `npm start` disponible en el dominio HTTPS esperado, sin imprimir credenciales.
- Verificación del repositorio posterior: TypeScript correcto, 36/36 pruebas unitarias, 57/57 integraciones seriales y build Vite correcto.
- Se eliminó una fecha fija del caso de avisos de inventario para que su deduplicación diaria se pruebe contra la fecha America/Bogota realmente usada por la API.

## Respaldo y límites

- PITR de Railway: habilitado.
- Almacenamiento de PITR: conectado (`bucketWired=true`).
- La sesión CLI actual no pudo ejecutar una copia manual etiquetada ni completar la sonda SSH de cobertura por falta de concesión OAuth/registro de la clave SSH. No se registró el enlace temporal que devolvió la CLI.
- Por lo anterior, GO-04 no está cerrado: falta reautenticar la CLI, ejecutar una restauración en un destino aislado, medir el RTO y aprobar responsable, presupuesto, RPO y retención.
- PITR cubre hechos recibidos por PostgreSQL. No cubre operaciones que permanezcan exclusivamente en IndexedDB sin acuse central.

## Resultado

El alojamiento técnico y AC-011-08 quedaron verificados. Esto no autoriza ventas reales: GO-05 (hardware) y GO-06 (autorización final), además del cierre operativo de GO-04, siguen pendientes.
