import type { Database } from 'sql.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTienda } from '../test/tienda';

let db: Database;

function value(sql: string): unknown {
  return db.exec(sql)[0]?.values[0]?.[0];
}

beforeAll(async () => {
  db = await openTienda();
});

afterAll(() => {
  db.close();
});

describe('sample database tienda', () => {
  it('runs on the SQLite version bundled by sql.js', () => {
    expect(value('SELECT sqlite_version()')).toBe('3.49.1');
  });

  it('supports window functions and recursive CTEs, which the syllabus relies on', () => {
    expect(
      value(`SELECT max(r) FROM (SELECT ROW_NUMBER() OVER (ORDER BY id) AS r FROM clientes)`),
    ).toBe(50);
    expect(
      value(`WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5)
             SELECT sum(i) FROM n`),
    ).toBe(15);
  });

  it('has foreign keys enabled and no broken references', () => {
    expect(value('PRAGMA foreign_keys')).toBe(1);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it.each([
    ['categorias', 14],
    ['productos', 40],
    ['clientes', 50],
    ['pedidos', 300],
    ['lineas_pedido', 850],
    ['pagos', 253],
    ['empleados', 16],
    ['resenas', 120],
  ])('has the expected number of rows in %s', (table, count) => {
    expect(value(`SELECT count(*) FROM ${table}`)).toBe(count);
  });

  it('is deterministic: fixed dates and totals that never change', () => {
    expect(
      value("SELECT group_concat(fecha, ',') FROM (SELECT fecha FROM pedidos ORDER BY id LIMIT 3)"),
    ).toBe('2024-01-01,2024-01-02,2024-01-03');
    expect(value("SELECT min(fecha) || ' / ' || max(fecha) FROM pedidos")).toBe(
      '2024-01-01 / 2024-12-28',
    );
    expect(value('SELECT round(sum(cantidad * precio_unitario), 2) FROM lineas_pedido')).toBe(
      223747.3,
    );
    expect(value('SELECT round(sum(importe), 2) FROM pagos')).toBe(191089.86);
  });

  it('has orders without payment and orders paid in two instalments', () => {
    expect(
      value(
        'SELECT count(*) FROM pedidos AS p WHERE NOT EXISTS (SELECT 1 FROM pagos WHERE pedido_id = p.id)',
      ),
    ).toBe(55);
    expect(
      value(
        'SELECT count(*) FROM (SELECT pedido_id FROM pagos GROUP BY pedido_id HAVING count(*) = 2)',
      ),
    ).toBeGreaterThan(0);
  });

  it('has only paid, shipped or delivered orders among the paid ones', () => {
    expect(
      value(`SELECT count(*) FROM pagos JOIN pedidos ON pedidos.id = pagos.pedido_id
             WHERE estado IN ('pendiente', 'cancelado')`),
    ).toBe(0);
  });

  it('has customers without orders and products never sold, for LEFT JOIN', () => {
    expect(
      value('SELECT count(*) FROM clientes WHERE id NOT IN (SELECT cliente_id FROM pedidos)'),
    ).toBe(5);
    expect(
      value(
        'SELECT count(*) FROM productos WHERE id NOT IN (SELECT producto_id FROM lineas_pedido)',
      ),
    ).toBe(4);
  });

  it('has NULLs to practise with: reviews without text and customers without city', () => {
    expect(value('SELECT count(*) FROM resenas WHERE texto IS NULL')).toBe(30);
    expect(value('SELECT count(*) FROM clientes WHERE ciudad IS NULL')).toBe(3);
  });

  it('has a three-level category tree', () => {
    expect(value('SELECT count(*) FROM categorias WHERE padre_id IS NULL')).toBe(3);
    expect(
      value(`WITH RECURSIVE arbol (id, profundidad) AS (
               SELECT id, 1 FROM categorias WHERE padre_id IS NULL
               UNION ALL
               SELECT c.id, a.profundidad + 1 FROM categorias AS c JOIN arbol AS a ON c.padre_id = a.id
             )
             SELECT max(profundidad) FROM arbol`),
    ).toBe(3);
  });

  it('has a single-root employee hierarchy four levels deep, with tied salaries', () => {
    expect(value('SELECT count(*) FROM empleados WHERE jefe_id IS NULL')).toBe(1);
    expect(
      value(`WITH RECURSIVE cadena (id, nivel) AS (
               SELECT id, 1 FROM empleados WHERE jefe_id IS NULL
               UNION ALL
               SELECT e.id, c.nivel + 1 FROM empleados AS e JOIN cadena AS c ON e.jefe_id = c.id
             )
             SELECT max(nivel) || '/' || count(*) FROM cadena`),
    ).toBe('4/16');
    expect(
      value(`SELECT count(*) FROM (SELECT departamento, salario FROM empleados
             GROUP BY departamento, salario HAVING count(*) > 1)`),
    ).toBeGreaterThan(0);
  });

  it('does not tie attributes to the customer: generated values vary within each customer', () => {
    expect(
      value(`SELECT count(*) FROM (SELECT cliente_id FROM pedidos
             GROUP BY cliente_id HAVING count(DISTINCT estado) > 1)`),
    ).toBeGreaterThanOrEqual(40);
    expect(
      value(`SELECT count(*) FROM (SELECT p.cliente_id FROM pedidos AS p
             JOIN pagos AS pa ON pa.pedido_id = p.id
             GROUP BY p.cliente_id HAVING count(DISTINCT pa.metodo) > 1)`),
    ).toBeGreaterThanOrEqual(40);
    expect(
      value(`SELECT count(*) FROM (SELECT cliente_id FROM resenas
             GROUP BY cliente_id HAVING count(*) > 1 AND count(DISTINCT nota) = 1)`),
    ).toBe(0);
  });

  it('gives every customer with orders at least one payment', () => {
    expect(
      value(
        'SELECT count(DISTINCT p.cliente_id) FROM pedidos AS p JOIN pagos AS pa ON pa.pedido_id = p.id',
      ),
    ).toBe(value('SELECT count(DISTINCT cliente_id) FROM pedidos'));
  });

  it('has no customer reviewing the same product twice', () => {
    expect(
      value(
        'SELECT count(*) FROM (SELECT 1 FROM resenas GROUP BY cliente_id, producto_id HAVING count(*) > 1)',
      ),
    ).toBe(0);
  });

  it('has order dates that never go back and some days with more than one order', () => {
    expect(
      value(`SELECT count(*) FROM (SELECT fecha, lag(fecha) OVER (ORDER BY id) AS anterior FROM pedidos)
             WHERE fecha < anterior`),
    ).toBe(0);
    expect(
      value('SELECT count(*) FROM (SELECT fecha FROM pedidos GROUP BY fecha HAVING count(*) > 1)'),
    ).toBeGreaterThan(0);
  });

  it('rejects rows that break its constraints', () => {
    expect(() =>
      db.exec(
        "INSERT INTO pedidos (cliente_id, fecha, estado) VALUES (999, '2024-01-01', 'pendiente')",
      ),
    ).toThrow(/FOREIGN KEY/);
    expect(() =>
      db.exec('INSERT INTO resenas (producto_id, cliente_id, nota) VALUES (1, 1, 6)'),
    ).toThrow(/CHECK/);
    expect(() =>
      db.exec(
        "INSERT INTO clientes (nombre, email, alta) VALUES ('X', 'ana.martin@example.com', '2024-01-01')",
      ),
    ).toThrow(/UNIQUE/);
  });
});
