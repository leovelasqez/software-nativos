# DEC-005 — Decisión requerida: costo promedio con negativos y entradas tardías

Estado: propuesta; no autoriza implementación. Afecta REQ-003-05, REQ-008-02, AC-003-04 y los informes de margen.

## Hecho ya acordado

Las cantidades de inventario pueden quedar negativas. Hoy se conserva el libro causal y se restringen costo/margen al dueño, pero no se calcula ni se muestra un promedio que pueda reinterpretar historia.

## Decisión que falta

Cuando una salida deja saldo negativo y llega posteriormente una compra o ajuste de entrada, definir el costo de esa salida y si una entrada tardía puede modificar informes históricos ya consultados/exportados.

## Alternativas

### A. Costo provisional cero/desconocido hasta conciliación manual

Una salida sin saldo suficiente queda con costo `null`; la siguiente entrada no reescribe la salida. El dueño registra una conciliación causal, con motivo, que completa el costo desde la fecha elegida.

- Ventaja: máxima trazabilidad, no reescribe historia ni inventa costo.
- Consecuencia: margen/informe puede aparecer como «pendiente» durante la operación normal.
- Requiere una interfaz de conciliación exclusiva del dueño.

### B. Promedio móvil con saldo negativo y recálculo prospectivo

Una salida negativa usa el último promedio conocido cuando existe; una entrada posterior cambia el promedio sólo para movimientos futuros. Si nunca hubo promedio, la salida queda `null`.

- Ventaja: informes disponibles cuando hay último costo conocido; no se reescribe historia.
- Consecuencia: el saldo negativo puede hacer que el promedio futuro sea poco intuitivo; los márgenes previos no se corrigen cuando llega factura tardía.
- Requiere fijar qué entradas participan (compra, inicial, ajuste) y bloquear costo para entrada sin valor.

### C. Promedio móvil retroactivo por período abierto

Las salidas negativas quedan provisionales y una entrada posterior recalcula las salidas afectadas dentro de un período contable abierto; al cerrarlo, no hay recálculo.

- Ventaja: margen final del período refleja la entrada tardía.
- Consecuencia: informes/exportaciones cambian hasta el cierre; requiere períodos, versiones de valoración, reemisión y auditoría más complejos.
- Añade una capacidad contable que el alcance actual no tiene.

## Recomendación técnica

Elegir **A** para la primera versión: mantiene el libro inmutable, no introduce períodos contables ni costos inferidos y distingue explícitamente `null` de cero. Si el negocio necesita margen operativo inmediato, elegir **B** con la condición de no recalcular salidas históricas; **C** debe esperar a una decisión de contabilidad/períodos.

## Criterios de aceptación una vez elegida

1. Una salida con saldo insuficiente nunca recibe costo cero por defecto.
2. Una entrada tardía no altera comprobantes ni inventario cuantitativo histórico.
3. Todo costo provisional, conciliado o promedio conserva su movimiento causal, actor, motivo y versión.
4. Cajero y encargado no obtienen costo/margen por API, exportación, caché ni agente.
5. Los informes distinguen costo desconocido de costo numérico y señalan la fecha de valoración.
