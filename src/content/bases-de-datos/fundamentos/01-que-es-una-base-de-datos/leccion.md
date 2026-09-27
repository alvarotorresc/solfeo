---
id: bd-f-01
modulo: bases-de-datos
nivel: fundamentos
orden: 1
titulo: Qué es una base de datos
resumen: >-
  Por qué los datos tienen que sobrevivir al programa que los crea, qué hace el software que los
  gestiona y qué familias de bases de datos existen, vistas desde lejos.
fuentes:
  - titulo: 'CMU 15-445, lección 1: modelo relacional (apuntes del curso)'
    url: https://15445.courses.cs.cmu.edu/fall2024/notes/01-relationalmodel.pdf
  - titulo: 'PostgreSQL: conceptos (tutorial oficial)'
    url: https://www.postgresql.org/docs/current/tutorial-concepts.html
  - titulo: 'SQLite: qué es SQLite'
    url: https://www.sqlite.org/about.html
  - titulo: 'SQLite: cuándo usarlo y cuándo no'
    url: https://www.sqlite.org/whentouse.html
  - titulo: 'MongoDB: documentos'
    url: https://www.mongodb.com/docs/manual/core/document/
  - titulo: 'Redis: cadenas, con SET y GET'
    url: https://redis.io/docs/latest/develop/data-types/strings/
estado: revisado
---

Imagina la tienda de este curso sin base de datos. Un cliente hace un pedido, el programa lo guarda
en una variable y todo va bien hasta que el servidor se reinicia. En ese momento el pedido
desaparece, porque vivía en la memoria del proceso y la memoria se vacía al apagarse. Casi todas
las aplicaciones necesitan lo contrario: recordar cosas durante años.

## Persistencia: que los datos sobrevivan

Un dato es **persistente** cuando sigue existiendo después de que termine el programa que lo creó.
Para eso tiene que acabar en un almacenamiento que no se borre al apagar la máquina, como un disco.

Guardar en disco parece fácil: escribes un archivo y listo. La primera versión de muchas
aplicaciones hace justo eso, con un CSV o un JSON por cada tipo de cosa. Funciona hasta que aparecen
las preguntas incómodas:

- **Integridad.** ¿Qué impide que alguien escriba «mañana» en la columna del precio, o que un pedido
  apunte a un cliente que ya no existe?
- **Búsqueda.** Para encontrar un pedido concreto hay que leer el archivo entero, y cada programa que
  quiera hacerlo tiene que saber cómo está escrito.
- **Concurrencia.** Si dos peticiones guardan a la vez en el mismo archivo, una puede pisar lo que
  escribió la otra.
- **Fallos.** Si la máquina se cae a mitad de una escritura, el archivo puede quedar a medias y ya
  no sabes qué parte es buena.

Resolver todo eso bien es muchísimo trabajo. Por eso existe un software dedicado solo a ello.

## Base de datos y SGBD no son lo mismo

Una **base de datos** es un conjunto organizado de datos relacionados entre sí que describe una
parte del mundo: los clientes, productos y pedidos de una tienda, por ejemplo.

Un **sistema gestor de bases de datos** (SGBD, en inglés DBMS) es el programa que se encarga de
esos datos: los guarda, los protege y responde a las consultas. PostgreSQL, MySQL, SQLite y MongoDB
son SGBD. Cuando alguien dice «usamos PostgreSQL como base de datos», habla del gestor, no de los
datos, y conviene tener clara la diferencia.

Entre lo que un SGBD te da hecho:

- Un lenguaje para pedir y cambiar datos sin saber cómo están guardados en disco.
- Reglas que los datos tienen que cumplir, y que el propio gestor hace respetar.
- Acceso de varias peticiones a la vez sin que se pisen.
- Recuperación tras un fallo, para que la base no quede a medias.

Hay gestores con arquitecturas muy distintas. PostgreSQL funciona como un servidor: un proceso
aparte al que las aplicaciones se conectan, a menudo desde otras máquinas. SQLite no tiene servidor:
es una biblioteca que la aplicación lleva dentro y que lee y escribe directamente un archivo en
disco, donde cabe la base entera con todas sus tablas. No compiten por el mismo sitio. Un servidor
sirve a muchas aplicaciones a la vez; SQLite da almacenamiento local a una sola, como un móvil o
este mismo playground, que ejecuta SQLite dentro del navegador.

## Pedir el qué, no el cómo

La idea que hizo despegar a las bases de datos modernas es separar lo que quieres de cómo se
consigue. Tú escribes qué datos necesitas y el gestor decide cómo leerlos: qué archivo abrir, qué
índice usar, en qué orden recorrer las filas. A esa separación se le llama **independencia de los
datos**. Gracias a ella, el gestor puede cambiar su forma de almacenar sin que cambie tu código.

Así se le pide a la base `tienda` el producto con identificador 1:

```sql id=q1
SELECT id, nombre, precio
FROM productos
WHERE id = 1;
```

La consulta no dice nada de archivos ni de bucles. Es SQL, el lenguaje de las bases de datos
relacionales, y en la lección 4 lo verás con detalle.

## Familias de bases de datos

No todas las bases organizan los datos igual. La forma de organizarlos se llama **modelo de
datos**, y cada familia de gestores parte de uno. Estas son las tres que más vas a encontrar.

### Relacional

Los datos van en tablas. Cada tabla tiene columnas con nombre y tipo, fijadas de antemano en un
**esquema**, y cada fila es un registro. Las tablas se relacionan entre sí guardando el
identificador de una fila de otra tabla: un pedido lleva el `cliente_id` de quien lo hizo. Se
consulta con SQL. PostgreSQL, MySQL, SQLite y SQL Server son relacionales, y es la familia más
extendida. La base `tienda` es relacional, y el resto de este nivel trata de ella.

### Documental

Cada registro es un documento: una estructura de campos y valores, parecida a un objeto JSON, que
puede llevar dentro listas y otros documentos. Un pedido podría guardarse entero, con sus líneas
dentro:

```json
{
  "_id": 17,
  "cliente": { "nombre": "Ana Ruiz", "ciudad": "Sevilla" },
  "fecha": "2024-03-01",
  "lineas": [
    { "producto": "Ratón vertical", "cantidad": 1, "precio": 45 },
    { "producto": "Alfombrilla XL", "cantidad": 2, "precio": 19.9 }
  ]
}
```

Leer el pedido completo es una sola operación, y dos documentos de la misma colección pueden tener
campos distintos. El precio de esa flexibilidad es que, salvo que configures reglas de validación,
la base no vigila la forma de los datos: esa responsabilidad pasa a tu aplicación. MongoDB es el ejemplo más conocido y guarda los documentos
en BSON, una versión binaria de JSON con más tipos.

### Clave-valor

Es el modelo más sencillo: una clave única apunta a un valor, y las operaciones básicas son guardar
y leer por clave. Por ejemplo, en Redis:

```text
SET carrito:42 "producto=7;cantidad=2"
GET carrito:42
```

Buscar por clave es inmediato, pero preguntar «qué carritos contienen el producto 7» no es algo que
el modelo básico sepa responder, porque el valor es opaco para él. Encaja cuando siempre sabes la
clave de lo que buscas: sesiones de usuario, carritos, contadores.

Hay más familias, como las de grafos o las de columnas anchas. Las verás, junto con cuándo conviene
cada una, en el nivel avanzado.

## Dónde se tropieza

- **Confundir la base con el gestor.** Cambiar de SGBD no cambia tus datos, pero sí cómo los
  consultas, qué reglas se cumplen solas y cómo se comporta bajo carga.
- **Pensar que sin esquema no hay esquema.** Una base documental no obliga a una forma, pero tu
  código siempre espera una. Si la base no la vigila, la tiene que vigilar alguien.
- **Tomar SQLite por un juguete.** Es un gestor relacional completo; lo que no pretende es ser un
  servidor compartido por muchas aplicaciones.

## Para llevarte

- Persistir es que los datos sobrevivan al programa que los creó.
- La base de datos son los datos; el SGBD es el programa que los gestiona.
- Un SGBD resuelve integridad, concurrencia y recuperación, que un archivo suelto no resuelve.
- Relacional (tablas y SQL), documental (documentos anidados) y clave-valor (acceso por clave) son
  las familias que más vas a ver.
