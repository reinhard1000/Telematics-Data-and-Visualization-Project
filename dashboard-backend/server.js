const express = require('express');
const mariadb = require('mariadb');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();
const port = 5000;

// Load environment variables
dotenv.config();

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'homy',
  password: '#Homy1plar',
  database: 'hydralytica_dashboard',
  connectionLimit: 20,
  queueLimit: 0
});

// Enable CORS
app.use(cors());

// Helper function to convert BigInt to string
const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (typeof obj === 'object') {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = serializeBigInt(obj[key]);
      }
    }
  }
  return obj;
};

// API Route to fetch inventory data with filtering (pagination removed)
app.get('/api/inventory', async (req, res) => {
  const { searchTerm = '', searchCategory = 'device_id' } = req.query;

  const allowedCategories = ['device_id', 'customer_name', 'dealer_name'];
  if (!allowedCategories.includes(searchCategory)) {
    return res.status(400).json({ error: 'Invalid search category' });
  }

  let sqlQuery = `
    SELECT 
      tu.id AS device_id,
      tu.type AS device_type, 
      ui.customer_id,
      o1.name AS customer_name,
      ui.dealer_id,
      o2.name AS dealer_name,
      tu.h2gen_unit_id, 
      tu.enabled,
      tu.h2gen_installed,
      tu.fuel_lifetime,
      tu.fuel_telematics,
      tu.fuel_baseline_telematics,
      tu.fuel_baseline_lifetime,
      tu.odometer_lifetime,
      tu.odometer_baseline,
      tu.efficiency_baseline,
      tu.runtime_baseline,
      tu.runtime_lifetime,
      tu.baseline_date,
      tu.fuel_baseline_forced_calc
    FROM hydralytica_dashboard.dya_telematics_units AS tu
    LEFT JOIN hydralytica_dashboard.dya_h2gen_unit_info AS ui ON tu.h2gen_unit_id = ui.h2gen_id
    LEFT JOIN hydralytica_dashboard.dya_organizations AS o1 ON ui.customer_id = o1.id  
    LEFT JOIN hydralytica_dashboard.dya_organizations AS o2 ON ui.dealer_id = o2.parent_id
  `;

  if (searchTerm) {
    sqlQuery += ` AND LOWER(${searchCategory}) LIKE LOWER(?)`;
  }

  try {
    const connection = await pool.getConnection();
    const results = await connection.query(sqlQuery, [`%${searchTerm}%`]);
    connection.release(); // Release the connection back to the pool

    // Convert BigInt values to strings
    const serializedResults = results.map(serializeBigInt);

    res.json(serializedResults);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Error fetching inventory data from the database' });
  }
});

// API Route to fetch device data (pagination removed)
app.get('/api/device-data', async (req, res) => {
  const { searchTerm = '', searchCategory = 'device_id', startDate = '', endDate = '' } = req.query;

  const devDataQuery = `
    SELECT
      tu.id AS id,
      tu.telematics_id AS telematics_id,
      tu.h2gen_id AS h2gen_id,
      tu.timestamp,
      tu.fuel_lifetime,
      tu.fuel_telematics,
      tu.odometer,
      tu.engine_speed,
      tu.latitude,
      tu.longitude,
      tu.runtime,
      tu.speed
    FROM hydralytica_dashboard.dya_telematics_units_data AS tu
  `;

  // You can add filtering conditions here based on searchTerm, startDate, and endDate
  if (searchTerm) {
    devDataQuery += ` AND LOWER(${searchCategory}) LIKE LOWER(?)`;
  }
  if (startDate) {
    devDataQuery += ` AND tu.timestamp >= ?`;
  }
  if (endDate) {
    devDataQuery += ` AND tu.timestamp <= ?`;
  }

  try {
    const connection = await pool.getConnection();
    const results = await connection.query(devDataQuery, [
      `%${searchTerm}%`,
      startDate,
      endDate
    ]);
    connection.release(); // Release the connection back to the pool

    // Convert BigInt values to strings
    const serializedResults = results.map(serializeBigInt);

    res.json(serializedResults);
  } catch (err) {
    console.error('Error fetching device data:', err);
    res.status(500).json({ error: 'Error fetching device data from the database' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
