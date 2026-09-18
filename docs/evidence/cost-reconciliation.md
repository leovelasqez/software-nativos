# Evidencia — Conciliación causal de costos (014)

Fecha: 17-09-2026. Alcance autorizado por la respuesta 5A: costo desconocido hasta conciliación manual del dueño, sin reescribir historia.

## Resultado

- La migración 017 agrega un libro append-only por bodega y artículo con actor, costo unitario, fecha efectiva, motivo y creación.
- Sólo el dueño con `cost.read`/`cost.write` consulta o registra. Encargado y cajero reciben 403.
- La proyección actual prefiere la conciliación efectiva más reciente y usa un inicial vigente sólo como antecedente; ausencia fiable conserva `null`.
- Recetas consumen esa misma proyección. Auditoría registra identidad y causalidad sin copiar `unitCost`.
- Registrar una conciliación no modifica inventario, movimientos, ventas, comprobantes ni informes históricos.
- La interfaz de Inventario muestra costo pendiente, acción **Conciliar costo** y libro causal sólo al dueño. No se cargó ningún costo operativo: el usuario decidió no inventar conteos o valores físicos.

## Verificación

| Comando o flujo | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `npm test` | 33/33 correctas |
| `node --test --test-concurrency=1 tests/integration/catalog.test.ts` | 15/15 correctas |
| `npm run build` | Correcto |
| Administración > Inventario | Acciones y libro causal visibles al dueño; estado real continúa **Pendiente** |

## Límite

Esta capacidad no produce margen histórico ni costo promedio retroactivo. Cada salida pasada permanece sin valoración hasta que exista una política y hechos causales suficientes; cero nunca sustituye un costo desconocido.
