-- Minimal seed for the validator fixtures, independent of the sample database.
CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, precio REAL NOT NULL);
INSERT INTO productos (id, nombre, precio) VALUES (1, 'Lápiz', 1.5), (2, 'Cuaderno', 3), (3, 'Mochila', 25);
