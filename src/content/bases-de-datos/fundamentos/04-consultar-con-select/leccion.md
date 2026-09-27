---
id: bd-f-04
modulo: bases-de-datos
nivel: fundamentos
orden: 4
titulo: Consultar con SELECT
resumen: >-
  Cómo pedirle filas a una base de datos: elegir columnas, filtrar con WHERE, ordenar, quedarse con
  unas pocas, quitar repetidos y no tropezar con NULL.
fuentes:
  - titulo: 'SQLite: la sentencia SELECT'
    url: https://www.sqlite.org/lang_select.html
  - titulo: 'SQLite: cómo tratan NULL distintos motores'
    url: https://www.sqlite.org/nulls.html
  - titulo: 'PostgreSQL: consultar una tabla (tutorial oficial)'
    url: https://www.postgresql.org/docs/current/tutorial-select.html
  - titulo: 'PostgreSQL: ordenar filas con ORDER BY'
    url: https://www.postgresql.org/docs/current/queries-order.html
estado: revisado
---

Una consulta `SELECT` no cambia nada: describe qué filas quieres ver y en qué forma, y la base de
datos decide cómo conseguirlas. Tú dices el qué; el motor se encarga del cómo. Esa separación es la
idea central de SQL y conviene tenerla presente desde la primera consulta.

Todos los ejemplos usan la base `tienda`, la misma que tienes en el playground.

## La forma mínima

La consulta más corta pide todas las columnas de una tabla:

```sql id=q1
SELECT * FROM productos;
```

Devuelve los 40 productos. El asterisco es cómodo para curiosear, pero en código de verdad es mejor
nombrar las columnas: dejas claro qué necesitas, lees menos datos y la consulta no cambia de forma
si mañana alguien añade una columna a la tabla.

Fíjate también en otra cosa: esa consulta no dice en qué orden quiere las filas. Sin `ORDER BY`, el
orden **no está garantizado**. Hoy pueden salir por `id` y mañana en otro orden, porque el motor ha
elegido leerlas por un índice distinto. Si el orden te importa, pídelo siempre.

## Filtrar con WHERE

`WHERE` recibe una condición y el resultado solo conserva las filas en las que esa condición es
verdadera. Los productos de más de 500 euros, del más caro al más barato:

```sql id=q2
SELECT nombre, precio
FROM productos
WHERE precio > 500
ORDER BY precio DESC;
```

Las condiciones se combinan con `AND`, `OR` y `NOT`. Clientes de Madrid dados de alta a partir de
2023:

```sql id=q3
SELECT nombre, alta
FROM clientes
WHERE ciudad = 'Madrid' AND alta >= '2023-01-01'
ORDER BY alta;
```

En esta base las fechas se guardan como texto con el formato `AAAA-MM-DD`. Con ese formato, comparar
textos equivale a comparar fechas, por eso `alta >= '2023-01-01'` funciona.

Cuando mezcles `AND` y `OR`, usa paréntesis: `AND` se evalúa antes que `OR`, y una condición sin
paréntesis puede significar algo distinto de lo que parece.

Hay dos atajos muy habituales. `IN` comprueba si un valor está en una lista, y `BETWEEN` si está en
un rango con los dos extremos incluidos. Teclados y ratones (categorías 6 y 7) de entre 20 y 60
euros:

```sql id=q4
SELECT nombre, precio
FROM productos
WHERE categoria_id IN (6, 7) AND precio BETWEEN 20 AND 60
ORDER BY precio;
```

## Ordenar y quedarse con unas pocas filas

`ORDER BY` admite varias columnas: la segunda solo decide cuando la primera empata. `ASC` es el
orden por defecto y `DESC` lo invierte, columna a columna.

`LIMIT` corta el resultado y `OFFSET` se salta filas del principio. Juntos sirven para paginar. La
segunda página de pedidos, de cinco en cinco y de los más recientes a los más antiguos:

```sql id=q5
SELECT id, fecha, estado
FROM pedidos
ORDER BY fecha DESC, id DESC
LIMIT 5 OFFSET 5;
```

El `id DESC` del final no es decorativo. Si dos pedidos comparten fecha, sin él su orden quedaría al
azar y un pedido podría aparecer en dos páginas o en ninguna. `LIMIT` sin un `ORDER BY` completo da
resultados que no puedes repetir.

`LIMIT` no es SQL estándar, aunque lo entienden SQLite, PostgreSQL y MySQL. El estándar usa otra
forma, que PostgreSQL acepta y SQLite no:

```sql no-ejecutar motivo="Sintaxis estándar FETCH FIRST, que SQLite no admite"
SELECT id, fecha, estado
FROM pedidos
ORDER BY fecha DESC, id DESC
OFFSET 5 ROWS FETCH FIRST 5 ROWS ONLY;
```

## Quitar repetidos con DISTINCT

`DISTINCT` elimina las filas repetidas del resultado. Se aplica a la fila entera, no a la primera
columna. Las primeras ciudades de la lista de clientes, sin repetir:

```sql id=q6
SELECT DISTINCT ciudad
FROM clientes
ORDER BY ciudad
LIMIT 5;
```

La primera fila está vacía: es `NULL`, porque hay clientes sin ciudad. Para `DISTINCT`, todos los
`NULL` cuentan como el mismo valor, así que aparece una sola vez. Y sale primero porque SQLite
ordena `NULL` antes que cualquier otro valor. PostgreSQL hace lo contrario y lo pone al final. Si
necesitas un comportamiento concreto, dilo con `NULLS FIRST` o `NULLS LAST`, que entienden los dos:

```sql id=q7
SELECT nombre, ciudad
FROM clientes
ORDER BY ciudad NULLS LAST, nombre
LIMIT 3;
```

## NULL no es un valor, es una ausencia

`NULL` significa «no se sabe» o «no aplica». No es cero ni texto vacío. Por eso, comparar algo con
`NULL` usando `=` no da verdadero ni falso, sino un tercer resultado, desconocido. Y `WHERE` solo
deja pasar lo verdadero. Esta consulta parece buscar los clientes sin ciudad, pero no devuelve
ninguna fila:

```sql id=q8
SELECT nombre
FROM clientes
WHERE ciudad = NULL;
```

La forma correcta es `IS NULL`, o `IS NOT NULL` para lo contrario:

```sql id=q9
SELECT nombre
FROM clientes
WHERE ciudad IS NULL
ORDER BY nombre;
```

Lo mismo pasa con `<>`: `WHERE ciudad <> 'Madrid'` tampoco devuelve los clientes sin ciudad, porque
de ellos no se sabe si son de Madrid o no. La lógica de tres valores tiene más trampas, y el nivel
intermedio le dedica una lección entera.

## En qué orden se evalúa una consulta

Se escribe `SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT`, pero el motor la entiende en otro
orden lógico:

1. `FROM`: de qué tabla salen las filas.
2. `WHERE`: cuáles se quedan.
3. `SELECT`: qué columnas se calculan.
4. `DISTINCT`: se quitan los repetidos.
5. `ORDER BY`: se ordena.
6. `LIMIT` y `OFFSET`: se recorta.

Este orden explica varias cosas. `LIMIT` se aplica al final, así que primero se ordena todo y
después se corta. Y un alias definido en el `SELECT` todavía no existe cuando se evalúa el `WHERE`:
en PostgreSQL, filtrar por un alias da error. SQLite lo tolera como extensión propia, pero no
conviene acostumbrarse, porque esa consulta no funcionará en otros motores. El motor puede
ejecutarlo todo de forma más lista por dentro, pero el resultado siempre es el mismo que si
siguiera estos pasos.

## Para llevarte

- `SELECT` describe el resultado; no dice cómo obtenerlo.
- Sin `ORDER BY` no hay orden garantizado. Con `LIMIT`, ordena por algo que no empate.
- `DISTINCT` actúa sobre la fila completa.
- Con `NULL`, compara con `IS NULL` e `IS NOT NULL`, nunca con `=`.
