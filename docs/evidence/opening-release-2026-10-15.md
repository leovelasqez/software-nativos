# Preparación de apertura — 15-10-2026

## Alcance autorizado

El dueño solicita registrar los cambios pendientes, actualizar GitHub sin secretos ni datos sensibles y dejar producción y staging de Railway en la misma versión. La corrección de Caja corresponde a REQ/AC-018-08 a 11: selección de sucursal por cuenta, activación de destino autorizada desde el mismo navegador y conservación de perfiles y acceso offline.

La limpieza operativa es una tarea separada. El dueño eligió conservar configuración, clientes, puntos y existencias. Indicó que las cajas todavía no están detenidas/sincronizadas y que no se ejecute la limpieza hasta su confirmación. Esta preparación no borra datos ni retira instalaciones.

## Versiones de partida

- GitHub `main` y HEAD: `088ff1bd`, con documentación posterior al commit funcional MCP `a2d05a5`.
- Producción: despliegue `cc416762-8a90-4e6e-8af1-e060b869a99f`, paquete del commit `a2d05a5`; salud, 13 recursos públicos y 9 fronteras de autenticación/origen comprobados.
- Staging: despliegue `ffa981b3-ece3-46ba-955f-8c9aaa24c967`, commit `8711da38428447a0df76f195074251fd9aba4a65`, anterior a producción. Su base sigue sin configurar; no se copia información de producción.

## Revisión de seguridad y verificación

Los Excel comerciales no versionados se conservan localmente y se excluyen explícitamente de Git. El paquete Railway se prepara desde un archivo Git del commit exacto y una lista de fuentes/configuración, excluyendo datos locales, documentos, pruebas, hojas de cálculo y credenciales.

El escaneo de los cambios y las pruebas nuevas no encontró secretos. Dos avisos en el historial son huellas SHA-256 de archivos fuente en evidencia del commit MCP; se comprobó que coinciden con esos archivos normalizados a LF.

Validaciones locales:

- TypeScript: aprobado, repetido después del último ajuste de importación.
- Unitarias: 75/75 en la revisión inicial y 3/3 afectadas después del ajuste final.
- Integración: 68 casos aprobados en la ejecución inicial; el único fallo fue `initdb` terminado por su límite de 60 segundos al sincronizar la base temporal al disco, antes de ejecutar catálogo. Se repitió únicamente ese archivo y sus 16 casos pasaron. Cobertura efectiva: 84 casos de integración aprobados entre ambas ejecuciones.
- Compilación final: aprobada.
- Navegador: administración MCP aprobada en el primer recorrido. El recorrido general detectó esperas insuficientes al trasladar la caja antigua: el cliente abortaba a los cinco segundos una operación que abre y descifra datos con DPAPI. Esa petición dispone ahora de 60 segundos y las demás conservan su plazo anterior. La prueba espera el commit y la respuesta del reintento antes de validar la interfaz. También se corrigió y probó la conservación de Milán, turno y base al importar un agregado antiguo sin preferencias por cuenta.
- Recorrido general definitivo: aprobado, 1/1 en 4,8 minutos, con selección de caja por cuenta, operaciones comerciales sintéticas, exportación, fidelización, traslado/reintento, reinicio offline, actualización de service worker sin perder pendientes y recuperación de cobros. Un intento anterior presentó un fallo de red al exportar; el definitivo exigió carga del informe, respuesta HTTP 200 y descarga del archivo y pasó. No se atribuyó ese fallo transitorio a una causa de aplicación no demostrada.

Los registros completos permanecen en `.local/`, excluidos de Git y del despliegue. No se presenta la ejecución inicial de `npm run check` como exitosa: las comprobaciones pendientes se completaron por componente después del fallo de infraestructura.

## Publicación del mismo commit

La publicación usa el commit que contiene este documento, primero en staging y después en producción. El mensaje de cada despliegue identifica el SHA completo. Se verifican salud, estado de configuración esperado, huellas de todos los recursos públicos y rechazos de consultas sin autenticación/origen ajeno, sin crear operaciones comerciales.

Los identificadores y resultados de publicación se guardan en evidencia local fuera de Git. Esto evita crear después un commit documental distinto del publicado y permite comprobar igualdad exacta entre `origin/main`, HEAD y el origen del paquete enviado a ambos entornos.

La igualdad de backend se acredita por la procedencia del archivo Git y el mensaje del despliegue; no se dispone todavía de SSH registrado para leer huellas dentro de los contenedores.

## Limpieza pendiente

El plan privado contempla respaldo y restauración aislada, conservación verificable de configuración/clientes/puntos/existencias, aperturas técnicas de saldos y retirada controlada del estado operativo offline para impedir que reaparezcan registros anteriores. No hay una operación de reset disponible en la API y el arranque productivo no habilita la API de respaldo local. La ejecución requiere resolver el acceso privado de mantenimiento y recibir la confirmación del dueño del corte de ambas cajas.
