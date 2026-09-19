# Revisión complementaria con Playwright CLI

Solo para un servidor E2E recién creado, datos sintéticos y navegador aislado. No ejecutar setup.js en una instalación del negocio. Los scripts corresponden al recorrido del 19-09-2026; usan selectores de pantallas inspeccionadas y el puerto E2E 4320.

1. `npm.cmd run build`, crear `output/playwright/visual-redesign` y ejecutar `node scripts/e2e-server.ts` en una terminal propia.
2. Abrir con `npx.cmd --yes --package @playwright/cli playwright-cli -s=nativos-review open http://127.0.0.1:4320 --browser msedge`. Tomar snapshot.
3. `run-code --filename docs/evidence/visual-redesign/qa/setup.js`: crea dueño/contraseña aleatoria y 18 productos sintéticos, tres mínimos y capturas de acceso.
4. `modules.js`: 90 variantes de los 15 módulos. `accessibility.js`: 60 auditorías axe. `form.js`: cuatro variantes de formulario y teclado; requiere ejecutar accessibility.js en ese contexto para cargar axe.
5. Desde la UI, abrir Caja, activar Centro, abrir turno con base sintética 50000 y seleccionar Granola artesanal. Con su editor abierto, `pos.js` crea seis líneas y abre el cobro tras comprobar las columnas.
6. `charge.js` confirma **una venta sintética** de 64000 con propina de 1000 y captura impresión. Mantener el comprobante abierto para `receipt-offline.js`, que verifica impresión, sincroniza, recarga desconectado y abre Administración.
7. `dashboard.js`: 17 comprobaciones del Resumen poblado, carreras de red y bodega no predeterminada; añade una bodega y mínimo sintéticos.
8. Cerrar la sesión CLI con `close`, detener el servidor de revisión y ejecutar `node -e "import('./scripts/e2e-teardown.ts').then(m=>m.default())"` para apagar su PostgreSQL.

Cada llamada usa el prefijo de la sesión:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli -s=nativos-review run-code --filename docs/evidence/visual-redesign/qa/modules.js
```

Los scripts generan capturas en output/playwright/visual-redesign. La contraseña aleatoria se usa solo en el contexto sintético; no se imprime ni se fija en el código. Las respuestas 503 y el retardo de Milán se simulan en el navegador, mientras que los indicadores y el cobro sí atraviesan el servidor/IndexedDB de pruebas.
