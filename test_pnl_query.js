import mysql from 'mysql2/promise';

async function testPnLQueries() {
  const conn = await mysql.createConnection({
    host: '103.139.155.175',
    user: 'testv1',
    password: 'skeLdYCEGkFESpdZ',
    database: 'testv1'
  });
  console.log('✅ Connected to MySQL!');

  const [revenueRows] = await conn.query(`
    SELECT 
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.price), 0) as net_revenue
    FROM orders o
    WHERE o.status = 'completed'
  `);
  console.log('Revenue rows:', revenueRows);

  const [customerStats] = await conn.query(`
    SELECT 
      o.user_id,
      COUNT(o.id) as order_count,
      SUM(o.price) as total_spent
    FROM orders o
    WHERE o.status = 'completed'
    GROUP BY o.user_id
  `);
  console.log('Customer stats:', customerStats);

  const [productMatrix] = await conn.query(`
    SELECT 
      p.id as product_id,
      p.name as product_name,
      COUNT(o.id) as sold_count,
      COALESCE(SUM(o.price), 0) as revenue
    FROM products p
    JOIN orders o ON p.id = o.product_id AND o.status = 'completed'
    GROUP BY p.id, p.name
  `);
  console.log('Product matrix:', productMatrix);

  await conn.end();
}

testPnLQueries().catch(console.error);
