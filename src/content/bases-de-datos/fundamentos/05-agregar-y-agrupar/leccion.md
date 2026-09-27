---
id: bd-f-05
modulo: bases-de-datos
nivel: fundamentos
orden: 5
titulo: Agregar y agrupar
resumen: >-
  Cómo resumir muchas filas en una cifra con COUNT, SUM y AVG, cómo calcular esa cifra por grupos
  con GROUP BY y cómo filtrar los grupos con HAVING sin confundirlo con WHERE.
fuentes:
  - titulo: 'SQLite: funciones de agregado'
    url: https://www.sqlite.org/lang_aggfunc.html
  - titulo: 'SQLite: la sentencia SELECT (agrupación y columnas sueltas)'
    url: https://www.sqlite.org/lang_select.html
  - titulo: 'PostgreSQL: funciones de agregado (tutorial oficial)'
    url: https://www.postgresql.org/docs/current/tutorial-agg.html
  - titulo: 'PostgreSQL: referencia de las funciones de agregado'
    url: https://www.postgresql.org/docs/current/functions-aggregate.html
  - titulo: 'PostgreSQL: la sentencia SELECT (GROUP BY y HAVING)'
    url: https://www.postgresql.org/docs/current/sql-select.html
estado: revisado
---

Hasta ahora cada consulta devolvía filas de la tabla, una a una. Muchas preguntas de negocio no
quieren filas, sino cifras: cuántos pedidos hay, cuánto se ha cobrado, cuál es la nota media de un
producto. Para eso están las **funciones de agregado**: reciben muchas filas y devuelven un solo
valor.

## Una cifra para toda la tabla

Las cinco más usadas son `COUNT` (cuántas), `SUM` (suma), `AVG` (media), `MIN` y `MAX`. Un
resumen del catálogo:

```sql id=q1
SELECT COUNT(*) AS productos,
       MIN(precio) AS mas_barato,
       MAX(precio) AS mas_caro,
       ROUND(AVG(precio), 2) AS precio_medio
FROM productos;
```

Cuarenta productos se convierten en una sola fila. El `ROUND` no es decorativo: los precios son
números decimales y una media sin redondear puede salir con una cola de cifras que nadie quiere
ver. Los alias con `AS` dan nombre a cada columna del resultado; sin ellos, el nombre dependería del
motor.

## `COUNT(*)` y `COUNT(columna)` no cuentan lo mismo

Esta es la trampa más frecuente del tema. `COUNT(*)` cuenta filas, sin mirar qué contienen.
`COUNT(columna)` cuenta solo las filas en las que esa columna **no es NULL**. Y
`COUNT(DISTINCT columna)` cuenta los valores distintos, también sin los NULL.

En `resenas`, el texto es opcional:

```sql id=q2
SELECT COUNT(*) AS resenas,
       COUNT(texto) AS con_texto,
       COUNT(DISTINCT producto_id) AS productos_resenados
FROM resenas;
```

Hay 120 reseñas, pero solo 90 tienen texto. Si alguien pregunta «cuántas reseñas hay» y respondes
con `COUNT(texto)`, te faltan 30 sin que ningún error te avise.

La regla de ignorar los NULL no es exclusiva de `COUNT`. `SUM`, `AVG`, `MIN` y `MAX` también los
saltan. Con `AVG` eso tiene una consecuencia que conviene ver con números: si una columna tiene los
valores 4, NULL y 2, la media es 3, no 2. Se divide entre los dos valores que existen, no entre las
tres filas. Cuando quieras que una ausencia cuente como cero, tienes que decirlo tú.

## Cuando no hay nada que sumar

¿Qué devuelve una suma sobre ninguna fila? La intuición dice cero, pero SQL dice NULL. En la tienda
no hay pagos en efectivo, así que:

```sql id=q3
SELECT COUNT(*) AS pagos,
       SUM(importe) AS total,
       COALESCE(SUM(importe), 0) AS total_o_cero
FROM pagos
WHERE metodo = 'efectivo';
```

`COUNT` sí devuelve 0, pero `SUM` devuelve NULL. Pasa igual en SQLite y en PostgreSQL, porque lo
exige el estándar. `COALESCE(x, 0)` devuelve el primer valor que no sea NULL, y es la forma portable
de convertir esa ausencia en un cero. SQLite tiene además `TOTAL()`, que devuelve 0.0 en lugar de
NULL, pero solo existe en SQLite.

## Una cifra por grupo con GROUP BY

Casi nunca interesa una sola cifra para toda la tabla, sino una por cada categoría, estado o
cliente. `GROUP BY` reparte las filas en grupos según el valor de una o más columnas, y los
agregados se calculan dentro de cada grupo. Cuántos pedidos hay en cada estado:

```sql id=q4
SELECT estado, COUNT(*) AS pedidos
FROM pedidos
GROUP BY estado
ORDER BY pedidos DESC;
```

Trescientas filas de pedidos se convierten en cinco, una por estado. Otro ejemplo, sobre importes y
con su redondeo:

```sql id=q5
SELECT metodo, COUNT(*) AS pagos, ROUND(SUM(importe), 2) AS total
FROM pagos
GROUP BY metodo
ORDER BY total DESC;
```

Fíjate en que bizum y transferencia tienen el mismo número de pagos pero totales distintos. Contar y
sumar responden preguntas diferentes.

### Los NULL forman su propio grupo

Al agrupar, todos los NULL van juntos a un único grupo. Clientes por ciudad:

```sql id=q6
SELECT ciudad, COUNT(*) AS clientes, COUNT(ciudad) AS con_ciudad
FROM clientes
GROUP BY ciudad
ORDER BY clientes DESC, ciudad
LIMIT 5;
```

La última fila es el grupo de los tres clientes sin ciudad. Mira sus dos cuentas: `COUNT(*)` da 3
y `COUNT(ciudad)` da 0, porque dentro de ese grupo la ciudad es NULL en todas las filas. Es la
trampa del apartado anterior vista desde otro ángulo.

### Qué columnas puedes poner en el SELECT

En cuanto agrupas, cada fila del resultado representa un grupo entero. Por eso en el `SELECT` solo
tiene sentido poner columnas del `GROUP BY` o agregados. Esta consulta pide el nombre de un producto
por cada categoría, pero cada categoría tiene varios:

```sql no-ejecutar motivo="PostgreSQL da error y SQLite devuelve un nombre arbitrario"
SELECT categoria_id, nombre, COUNT(*) AS productos
FROM productos
GROUP BY categoria_id;
```

PostgreSQL la rechaza con un error. SQLite la acepta como extensión propia y rellena `nombre` con el
de una fila cualquiera del grupo, sin garantizar cuál. Ese resultado parece correcto y no lo es, así
que no te fíes de que SQLite lo admita: pon la columna en el `GROUP BY` o mete su valor en un
agregado.

## Filtrar grupos con HAVING

`WHERE` filtra filas **antes** de agrupar. Por eso no puede usar agregados: cuando se evalúa, los
grupos todavía no existen. Esta consulta da error en cualquier motor:

```sql no-ejecutar motivo="Da error: WHERE no admite funciones de agregado"
SELECT producto_id, AVG(nota) AS nota_media
FROM resenas
WHERE AVG(nota) >= 4
GROUP BY producto_id;
```

Para filtrar grupos está `HAVING`, que se evalúa **después** de agrupar y sí puede usar agregados.
Productos con una nota media de 4 o más y al menos cuatro reseñas, para no premiar a uno con dos
reseñas buenas por casualidad:

```sql id=q7
SELECT producto_id, COUNT(*) AS resenas, ROUND(AVG(nota), 2) AS nota_media
FROM resenas
GROUP BY producto_id
HAVING AVG(nota) >= 4 AND COUNT(*) >= 4
ORDER BY nota_media DESC, producto_id;
```

En el `HAVING` se repite `AVG(nota)` en lugar de usar el alias `nota_media`. SQLite admitiría el
alias, pero PostgreSQL no lo permite en `HAVING` ni en `WHERE`. Repetir el agregado funciona en los
dos.

### WHERE y HAVING juntos

Los dos pueden convivir, y cambiar uno por otro cambia la pregunta. Compara la consulta anterior con
esta:

```sql id=q8
SELECT producto_id, COUNT(*) AS resenas_buenas
FROM resenas
WHERE nota >= 4
GROUP BY producto_id
HAVING COUNT(*) >= 3
ORDER BY resenas_buenas DESC, producto_id;
```

Aquí `WHERE` deja fuera las reseñas de menos de 4 antes de agrupar, así que cada grupo solo contiene
reseñas buenas. La pregunta ya no es «qué productos tienen buena media», sino «qué productos tienen
al menos tres reseñas buenas». El producto 6 aparece aquí y no en la consulta anterior: tiene tres
reseñas buenas, pero las otras dos le bajan la media de 4.

Regla práctica: si la condición mira una fila suelta, va en `WHERE`; si mira un agregado del grupo,
va en `HAVING`. Filtrar en `WHERE` todo lo que se pueda, además, ahorra trabajo, porque el motor
agrupa menos filas.

## El orden de evaluación, completo

La lección de `SELECT` presentaba el orden lógico de una consulta. Con agregados queda así:

1. `FROM`: de dónde salen las filas.
2. `WHERE`: qué filas se quedan.
3. `GROUP BY`: se forman los grupos.
4. `HAVING`: qué grupos se quedan.
5. `SELECT`: se calculan las columnas, incluidos los agregados.
6. `DISTINCT`: se quitan repetidos.
7. `ORDER BY`: se ordena.
8. `LIMIT` y `OFFSET`: se recorta.

Este orden explica todo lo anterior: `WHERE` no ve agregados porque va antes de `GROUP BY`, y
`HAVING` sí los ve porque va después. Y `ORDER BY` puede usar el alias de un agregado, como en el
recuento de pedidos por estado, porque se evalúa detrás del `SELECT`.

Cuando combines tablas con `JOIN`, en la lección siguiente, `COUNT(*)` y `COUNT(columna)` volverán a
dar resultados distintos, y ahí la diferencia importa todavía más.

## Para llevarte

- `COUNT(*)` cuenta filas; `COUNT(columna)` cuenta valores que no son NULL.
- Los agregados ignoran NULL, y `SUM` sobre ninguna fila da NULL, no cero.
- Con `GROUP BY`, en el `SELECT` solo van columnas agrupadas o agregados.
- `WHERE` filtra filas antes de agrupar; `HAVING` filtra grupos después.
- Todo agregado sobre importes, con `ROUND`.
