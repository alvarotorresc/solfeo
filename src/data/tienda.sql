-- Base de datos de ejemplo «tienda».
--
-- La usan el playground, las lecciones y las comprobaciones de contenido. Es determinista: no hay
-- fechas relativas a hoy ni valores aleatorios, así que cada consulta devuelve siempre lo mismo.
-- Los pedidos, sus líneas, los pagos y las reseñas se generan con aritmética sobre el número de
-- fila para tener volumen sin escribir cientos de filas a mano.

PRAGMA foreign_keys = ON;

CREATE TABLE categorias (
  id       INTEGER PRIMARY KEY,
  nombre   TEXT    NOT NULL UNIQUE,
  padre_id INTEGER REFERENCES categorias (id)
);

CREATE TABLE productos (
  id           INTEGER PRIMARY KEY,
  nombre       TEXT    NOT NULL,
  categoria_id INTEGER NOT NULL REFERENCES categorias (id),
  precio       REAL    NOT NULL CHECK (precio > 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE clientes (
  id     INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  email  TEXT NOT NULL UNIQUE,
  ciudad TEXT,
  alta   TEXT NOT NULL
);

CREATE TABLE pedidos (
  id         INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes (id),
  fecha      TEXT    NOT NULL,
  estado     TEXT    NOT NULL
    CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'))
);

CREATE INDEX idx_pedidos_cliente_fecha ON pedidos (cliente_id, fecha);

CREATE TABLE lineas_pedido (
  pedido_id       INTEGER NOT NULL REFERENCES pedidos (id),
  producto_id     INTEGER NOT NULL REFERENCES productos (id),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL    NOT NULL CHECK (precio_unitario > 0),
  PRIMARY KEY (pedido_id, producto_id)
);

CREATE TABLE pagos (
  id        INTEGER PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos (id),
  importe   REAL    NOT NULL CHECK (importe > 0),
  metodo    TEXT    NOT NULL CHECK (metodo IN ('tarjeta', 'transferencia', 'bizum')),
  fecha     TEXT    NOT NULL
);

CREATE TABLE empleados (
  id           INTEGER PRIMARY KEY,
  nombre       TEXT    NOT NULL,
  jefe_id      INTEGER REFERENCES empleados (id),
  departamento TEXT    NOT NULL,
  salario      INTEGER NOT NULL CHECK (salario > 0)
);

CREATE TABLE resenas (
  id          INTEGER PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos (id),
  cliente_id  INTEGER NOT NULL REFERENCES clientes (id),
  nota        INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  texto       TEXT
);

-- Tres niveles de categorías: raíz, subcategoría y, en algunos casos, una tercera.
INSERT INTO categorias (id, nombre, padre_id) VALUES
  (1, 'Informática', NULL),
  (2, 'Hogar', NULL),
  (3, 'Libros', NULL),
  (4, 'Portátiles', 1),
  (5, 'Periféricos', 1),
  (6, 'Teclados', 5),
  (7, 'Ratones', 5),
  (8, 'Monitores', 1),
  (9, 'Cocina', 2),
  (10, 'Iluminación', 2),
  (11, 'Pequeño electrodoméstico', 9),
  (12, 'Programación', 3),
  (13, 'Bases de datos', 12),
  (14, 'Novela', 3);

INSERT INTO productos (id, nombre, categoria_id, precio, stock) VALUES
  (1, 'Portátil Ligero 13', 4, 899.00, 12),
  (2, 'Portátil Pro 15', 4, 1499.00, 5),
  (3, 'Portátil Estudiante 14', 4, 549.00, 20),
  (4, 'Teclado mecánico compacto', 6, 89.90, 35),
  (5, 'Teclado inalámbrico', 6, 39.90, 60),
  (6, 'Teclado ergonómico dividido', 6, 149.00, 8),
  (7, 'Ratón óptico', 7, 14.90, 120),
  (8, 'Ratón vertical', 7, 45.00, 25),
  (9, 'Ratón para juegos', 7, 59.90, 0),
  (10, 'Alfombrilla XL', 5, 19.90, 80),
  (11, 'Hub USB-C', 5, 34.50, 40),
  (12, 'Webcam HD', 5, 49.00, 15),
  (13, 'Monitor 24 pulgadas', 8, 179.00, 18),
  (14, 'Monitor 27 pulgadas 4K', 8, 389.00, 7),
  (15, 'Monitor ultrapanorámico', 8, 529.00, 3),
  (16, 'Brazo para monitor', 8, 69.00, 22),
  (17, 'Cafetera de goteo', 11, 39.00, 30),
  (18, 'Hervidor eléctrico', 11, 29.90, 45),
  (19, 'Batidora de vaso', 11, 79.00, 10),
  (20, 'Tostadora', 11, 24.90, 0),
  (21, 'Juego de sartenes', 9, 64.00, 14),
  (22, 'Cuchillo de cocinero', 9, 42.00, 26),
  (23, 'Tabla de cortar de bambú', 9, 18.50, 50),
  (24, 'Lámpara de escritorio', 10, 32.00, 33),
  (25, 'Bombilla inteligente', 10, 12.90, 150),
  (26, 'Tira de luces LED', 10, 22.00, 64),
  (27, 'Lámpara de pie', 10, 89.00, 6),
  (28, 'Aprende SQL desde cero', 13, 29.95, 40),
  (29, 'Diseño de bases de datos relacionales', 13, 42.00, 12),
  (30, 'Rendimiento en SQL', 13, 38.50, 9),
  (31, 'Estructuras de datos en la práctica', 12, 35.00, 16),
  (32, 'Código limpio en equipo', 12, 31.00, 21),
  (33, 'Introducción a la programación', 12, 24.00, 30),
  (34, 'Patrones de arquitectura', 12, 45.00, 11),
  (35, 'La ciudad sin mapas', 14, 18.90, 25),
  (36, 'El faro del norte', 14, 21.50, 19),
  (37, 'Cartas desde el puerto', 14, 16.00, 0),
  (38, 'Silla de oficina', 2, 189.00, 4),
  (39, 'Regleta con interruptor', 2, 15.00, 70),
  (40, 'Soporte para portátil', 5, 27.00, 28);

-- Tres clientes sin ciudad, para practicar NULL. Los clientes 46 a 50 no han hecho pedidos.
INSERT INTO clientes (id, nombre, email, ciudad, alta) VALUES
  (1, 'Ana Martín', 'ana.martin@example.com', 'Madrid', '2022-01-14'),
  (2, 'Luis Gómez', 'luis.gomez@example.com', 'Sevilla', '2022-02-03'),
  (3, 'Marta Ruiz', 'marta.ruiz@example.com', 'Valencia', '2022-02-21'),
  (4, 'Javier López', 'javier.lopez@example.com', 'Madrid', '2022-03-09'),
  (5, 'Lucía Fernández', 'lucia.fernandez@example.com', 'Barcelona', '2022-03-30'),
  (6, 'Carlos Sánchez', 'carlos.sanchez@example.com', 'Bilbao', '2022-04-11'),
  (7, 'Elena Díaz', 'elena.diaz@example.com', 'Zaragoza', '2022-04-27'),
  (8, 'Pablo Moreno', 'pablo.moreno@example.com', NULL, '2022-05-06'),
  (9, 'Sara Álvarez', 'sara.alvarez@example.com', 'Málaga', '2022-05-19'),
  (10, 'Diego Romero', 'diego.romero@example.com', 'Madrid', '2022-06-02'),
  (11, 'Laura Navarro', 'laura.navarro@example.com', 'Valencia', '2022-06-15'),
  (12, 'Andrés Torres', 'andres.torres@example.com', 'Granada', '2022-07-01'),
  (13, 'Paula Domínguez', 'paula.dominguez@example.com', 'Barcelona', '2022-07-18'),
  (14, 'Miguel Vázquez', 'miguel.vazquez@example.com', 'Vigo', '2022-08-04'),
  (15, 'Irene Ramos', 'irene.ramos@example.com', 'Sevilla', '2022-08-22'),
  (16, 'Sergio Gil', 'sergio.gil@example.com', 'Madrid', '2022-09-07'),
  (17, 'Nuria Serrano', 'nuria.serrano@example.com', 'Murcia', '2022-09-26'),
  (18, 'Raúl Molina', 'raul.molina@example.com', 'Valladolid', '2022-10-10'),
  (19, 'Cristina Blanco', 'cristina.blanco@example.com', NULL, '2022-10-28'),
  (20, 'Alberto Castro', 'alberto.castro@example.com', 'Oviedo', '2022-11-14'),
  (21, 'Beatriz Ortega', 'beatriz.ortega@example.com', 'Barcelona', '2022-12-01'),
  (22, 'Óscar Rubio', 'oscar.rubio@example.com', 'Alicante', '2022-12-19'),
  (23, 'Patricia Marín', 'patricia.marin@example.com', 'Madrid', '2023-01-09'),
  (24, 'Hugo Sanz', 'hugo.sanz@example.com', 'Pamplona', '2023-01-27'),
  (25, 'Silvia Iglesias', 'silvia.iglesias@example.com', 'Salamanca', '2023-02-13'),
  (26, 'Adrián Núñez', 'adrian.nunez@example.com', 'Valencia', '2023-03-02'),
  (27, 'Rocío Medina', 'rocio.medina@example.com', 'Córdoba', '2023-03-20'),
  (28, 'Iván Garrido', 'ivan.garrido@example.com', 'Santander', '2023-04-06'),
  (29, 'Alicia Cortés', 'alicia.cortes@example.com', 'Madrid', '2023-04-24'),
  (30, 'Rubén Castillo', 'ruben.castillo@example.com', 'Bilbao', '2023-05-11'),
  (31, 'Noelia Santos', 'noelia.santos@example.com', 'Cádiz', '2023-05-29'),
  (32, 'Fernando Lozano', 'fernando.lozano@example.com', 'Toledo', '2023-06-15'),
  (33, 'Teresa Guerrero', 'teresa.guerrero@example.com', 'Barcelona', '2023-07-03'),
  (34, 'Víctor Cano', 'victor.cano@example.com', NULL, '2023-07-20'),
  (35, 'Eva Prieto', 'eva.prieto@example.com', 'Logroño', '2023-08-07'),
  (36, 'Mario Méndez', 'mario.mendez@example.com', 'Madrid', '2023-08-24'),
  (37, 'Claudia Calvo', 'claudia.calvo@example.com', 'Sevilla', '2023-09-11'),
  (38, 'Jorge Gallego', 'jorge.gallego@example.com', 'A Coruña', '2023-09-28'),
  (39, 'Inés Vidal', 'ines.vidal@example.com', 'Palma', '2023-10-16'),
  (40, 'Álvaro León', 'alvaro.leon@example.com', 'Valencia', '2023-11-02'),
  (41, 'Carmen Herrera', 'carmen.herrera@example.com', 'Madrid', '2023-11-20'),
  (42, 'Daniel Márquez', 'daniel.marquez@example.com', 'Zaragoza', '2023-12-07'),
  (43, 'Lorena Peña', 'lorena.pena@example.com', 'Huelva', '2023-12-22'),
  (44, 'Gonzalo Flores', 'gonzalo.flores@example.com', 'Barcelona', '2024-01-05'),
  (45, 'Marina Cabrera', 'marina.cabrera@example.com', 'Burgos', '2024-01-12'),
  (46, 'Tomás Campos', 'tomas.campos@example.com', 'Madrid', '2024-02-01'),
  (47, 'Julia Vega', 'julia.vega@example.com', 'Girona', '2024-03-15'),
  (48, 'Nicolás Fuentes', 'nicolas.fuentes@example.com', 'Sevilla', '2024-05-20'),
  (49, 'Olga Carrasco', 'olga.carrasco@example.com', 'León', '2024-08-08'),
  (50, 'Rafael Diez', 'rafael.diez@example.com', 'Madrid', '2024-10-30');

-- Jerarquía de cuatro niveles con una única raíz. Hay salarios repetidos dentro de un mismo
-- departamento para que RANK y ROW_NUMBER den resultados distintos.
INSERT INTO empleados (id, nombre, jefe_id, departamento, salario) VALUES
  (1, 'Rosa Aguilar', NULL, 'Dirección', 72000),
  (2, 'Tomás Benítez', 1, 'Tecnología', 58000),
  (3, 'Celia Pardo', 1, 'Ventas', 52000),
  (4, 'Ernesto Vila', 1, 'Logística', 48000),
  (5, 'Lidia Soto', 2, 'Tecnología', 45000),
  (6, 'Marcos Rey', 2, 'Tecnología', 45000),
  (7, 'Aitana Lara', 5, 'Tecnología', 36000),
  (8, 'Bruno Esteban', 5, 'Tecnología', 33000),
  (9, 'Noa Crespo', 6, 'Tecnología', 36000),
  (10, 'Gabriel Ibáñez', 3, 'Ventas', 38000),
  (11, 'Vera Montero', 3, 'Ventas', 34000),
  (12, 'Iker Bravo', 10, 'Ventas', 29000),
  (13, 'Olivia Pastor', 10, 'Ventas', 29000),
  (14, 'Hernán Roldán', 4, 'Logística', 31000),
  (15, 'Sofía Lorenzo', 14, 'Logística', 26000),
  (16, 'Unai Moya', 14, 'Logística', 26000);

-- 300 pedidos a lo largo de 2024, con fechas que nunca retroceden y algunos días con dos pedidos.
-- Los clientes 1 a 45 compran por turnos y el reparto se desplaza en cada vuelta, para que un
-- mismo cliente tenga pedidos en estados distintos. Los pendientes y los cancelados no tienen pago.
INSERT INTO pedidos (id, cliente_id, fecha, estado)
WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300)
SELECT
  i,
  ((i * 7 + (i / 45) * 11) % 45) + 1,
  date('2024-01-01', '+' || ((i - 1) * 365 / 300 - (CASE WHEN i % 10 = 0 THEN 1 ELSE 0 END)) || ' days'),
  CASE
    WHEN i % 20 = 0 THEN 'cancelado'
    WHEN i % 9 = 0 OR i > 290 THEN 'pendiente'
    WHEN i > 280 THEN 'pagado'
    WHEN i > 260 THEN 'enviado'
    ELSE 'entregado'
  END
FROM n;

-- Entre una y cinco líneas por pedido, sin repetir producto dentro del mismo pedido. Los productos
-- 37 a 40 no se venden nunca. Se guarda el precio del producto en el momento de la venta.
INSERT INTO lineas_pedido (pedido_id, producto_id, cantidad, precio_unitario)
WITH RECURSIVE
  n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300),
  k (j) AS (SELECT 1 UNION ALL SELECT j + 1 FROM k WHERE j < 5),
  lineas (pedido_id, producto_id, cantidad) AS (
    SELECT i, ((i * 13 + j * 7) % 36) + 1, 1 + ((i + j * 2) % 3)
    FROM n JOIN k ON j <= 1 + (i % 4) + (CASE WHEN i % 3 = 0 THEN 1 ELSE 0 END)
  )
SELECT l.pedido_id, l.producto_id, l.cantidad, p.precio
FROM lineas AS l
JOIN productos AS p ON p.id = l.producto_id
ORDER BY l.pedido_id, l.producto_id;

-- Un pago por pedido pagado, enviado o entregado. Cada 25 pedidos, el cliente lo paga en dos
-- plazos: esos pedidos tienen dos filas en esta tabla.
INSERT INTO pagos (pedido_id, importe, metodo, fecha)
WITH totales AS (
  SELECT pe.id, pe.fecha, SUM(l.cantidad * l.precio_unitario) AS total
  FROM pedidos AS pe
  JOIN lineas_pedido AS l ON l.pedido_id = pe.id
  WHERE pe.estado IN ('pagado', 'enviado', 'entregado')
  GROUP BY pe.id, pe.fecha
),
plazos (plazo) AS (VALUES (1), (2))
SELECT
  t.id,
  CASE WHEN t.id % 25 = 0 THEN round(t.total / 2, 2) ELSE round(t.total, 2) END,
  CASE t.id % 3 WHEN 0 THEN 'tarjeta' WHEN 1 THEN 'bizum' ELSE 'transferencia' END,
  date(t.fecha, CASE plazo WHEN 1 THEN '+1 day' ELSE '+31 days' END)
FROM totales AS t
JOIN plazos ON plazo = 1 OR t.id % 25 = 0
ORDER BY t.id, plazo;

-- 120 reseñas de los productos 1 a 30. Ningún cliente reseña dos veces el mismo producto, y quien
-- reseña varias veces no pone siempre la misma nota. Una de cada cuatro no tiene texto: el cliente
-- solo puso la nota.
INSERT INTO resenas (id, producto_id, cliente_id, nota, texto)
WITH RECURSIVE
  n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 120),
  r (i, nota) AS (SELECT i, 1 + ((i * 3 + (i - 1) / 45) % 5) FROM n)
SELECT
  i,
  (((i - 1) / 45 * 13 + i * 7) % 30) + 1,
  ((i - 1) % 45) + 1,
  nota,
  CASE
    WHEN i % 4 = 0 THEN NULL
    ELSE CASE nota
      WHEN 1 THEN 'Llegó dañado y el servicio de devolución fue lento.'
      WHEN 2 THEN 'Cumple, pero esperaba más calidad por este precio.'
      WHEN 3 THEN 'Correcto sin más.'
      WHEN 4 THEN 'Buen producto, lo volvería a comprar.'
      ELSE 'Excelente, superó lo que esperaba.'
    END
  END
FROM r;
