const express = require('express');
const mariadb = require('mariadb');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();
const port = 5005;

// Load environment variables
dotenv.config();

// Create a pool for MariaDB connection
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

// Helper function to validate date format
const isValidDate = (date) => !isNaN(new Date(date).getTime());

// Helper function to convert BigInt to string for JSON response
const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj === 'object') {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = serializeBigInt(obj[key]);
      }
    }
  }
  return obj;
};

// List of valid columns for searchCategory to prevent SQL injection and errors
const validSearchCategories = [
  'telematics_id',
  'h2gen_id',
  'fuel_lifetime',
  'fuel_telematics',
  'odometer',
  'engine_speed',
  'latitude',
  'longitude',
  'runtime',
  'speed',
  'id'
];

// Anomalies detection function
function detectAnomalies(data) {
  const anomalies = [];

  data.forEach((entry, index) => {
    if (index > 0) {
      const prevEntry = data[index - 1];

      // Check if odometer, fuel, or runtime values are decreasing
      if (typeof entry.odometer === 'number' && entry.odometer < prevEntry.odometer) {
        anomalies.push(`Odometer reset detected for ${entry.telematics_id} at ${entry.timestamp}`);
      }
      if (typeof entry.fuel_lifetime === 'number' && entry.fuel_lifetime < prevEntry.fuel_lifetime) {
        anomalies.push(`Fuel Lifetime reset detected for ${entry.telematics_id} at ${entry.timestamp}`);
      }
      if (typeof entry.runtime === 'number' && entry.runtime < prevEntry.runtime) {
        anomalies.push(`Runtime reset detected for ${entry.telematics_id} at ${entry.timestamp}`);
      }

      // Check if fuel and runtime values exist if there's speed data
      if (entry.speed > 0 && (entry.fuel_lifetime === null || entry.runtime === null)) {
        anomalies.push(`Missing fuel or runtime data for ${entry.telematics_id} at ${entry.timestamp}`);
      }
    }
  });

  return anomalies;
}

// For the last recorded time endpoint
app.get('/api/last-recorded-time', async (req, res) => {
  try {
    // SQL query to get the latest timestamp recorded
    const query = `
      SELECT MAX(timestamp) AS last_recorded_time
      FROM hydralytica_dashboard.dya_telematics_units_data;
    `;

    // Get a connection from the pool
    const connectionLastRecorded = await pool.getConnection();
    // Execute the query
    const results = await connectionLastRecorded.query(query);
    connectionLastRecorded.release();

    if (results.length === 0 || !results[0].last_recorded_time) {
      return res.json({ message: 'No data found' });
    }

    // Return the last recorded timestamp
    res.json({ last_recorded_time: results[0].last_recorded_time });
  } catch (err) {
    console.error('Error fetching last recorded time:', err.message);
    res.status(500).json({ error: `Error fetching last recorded time: ${err.message}` });
  }
});

// For the device dashboard endpoint
app.get('/api/device-dashboard', async (req, res) => {
  const { searchTerm = '', searchCategory = 'telematics_id', startDate = '', endDate = '', dateRange = 'last24hours' } = req.query;

  // Validate the searchCategory to prevent SQL injection and errors
  if (!validSearchCategories.includes(searchCategory)) {
    return res.status(400).json({ error: `Invalid search category: ${searchCategory}` });
  }

  let start, end;

  try {
    // Fetch the last recorded time from the database
    const connectionDeviceDashboard = await pool.getConnection();
    const query = `
      SELECT MAX(timestamp) AS last_recorded_time
      FROM hydralytica_dashboard.dya_telematics_units_data;
    `;
    const results = await connectionDeviceDashboard.query(query);
    connectionDeviceDashboard.release();

    // If no last recorded time is found, use the current date
    const lastRecordedTime = results.length > 0 && results[0].last_recorded_time
      ? new Date(results[0].last_recorded_time)
      : new Date();

    // Set the end date to the last recorded time if no endDate is provided
    end = endDate ? new Date(endDate) : lastRecordedTime;

    // Determine the start date based on the selected date range or startDate
    if (dateRange === 'last24hours') {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last7days') {
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last30days') {
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (startDate && isValidDate(startDate)) {
      start = new Date(startDate);
    } else {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Default to last 24 hours if no range or start date is given
    }

    const formattedStart = start.toISOString().split('T')[0];
    const formattedEnd = end.toISOString().split('T')[0];

    // Constructing the SQL query to get device dashboard data
    let devDataQuery = `
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
      WHERE tu.timestamp >= ? AND tu.timestamp <= ?
    `;

    const queryParams = [formattedStart, formattedEnd];

    // If searchTerm is provided, add it to the query and parameters
    if (searchTerm) {
      devDataQuery += ` AND LOWER(${searchCategory}) LIKE LOWER(?)`;
      queryParams.push(`%${searchTerm}%`);
    }

    // Get a connection from the pool
    const connectionDeviceData = await pool.getConnection();

    // Execute the query with the constructed parameters
    const resultsData = await connectionDeviceData.query(devDataQuery, queryParams);
    connectionDeviceData.release();

    // Detect anomalies in the fetched results
    const anomalies = detectAnomalies(resultsData);

    // Serialize the results to handle BigInt values
    const serializedResults = resultsData.map(serializeBigInt);

    // Send the response with data and anomalies
    res.json({ data: serializedResults, anomalies });
  } catch (err) {
    console.error('Error fetching device data:', err.message);
    res.status(500).json({ error: `Error fetching device data: ${err.message}` });
  }
});

// Endpoint to get the last recorded GPS coordinates based on selected time range
app.get('/api/last-recorded-gps', async (req, res) => {
  const { startDate = '', endDate = '', dateRange = 'last24hours' } = req.query;

  let start, end;

  try {
    // Fetch the last recorded time from the database
    const connectionGps = await pool.getConnection();
    const query = `
      SELECT MAX(timestamp) AS last_recorded_time
      FROM hydralytica_dashboard.dya_telematics_units_data
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `;
    const results = await connectionGps.query(query);
    connectionGps.release();

    // If no last recorded time is found, use the current date
    const lastRecordedTime = results.length > 0 && results[0].last_recorded_time
      ? new Date(results[0].last_recorded_time)
      : new Date();

    // Set the end date to the last recorded time if no endDate is provided
    end = endDate ? new Date(endDate) : lastRecordedTime;

    // Determine the start date based on the selected date range or startDate
    if (dateRange === 'last24hours') {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last7days') {
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'last30days') {
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (startDate && isValidDate(startDate)) {
      start = new Date(startDate);
    } else {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Default to last 24 hours if no range or start date is given
    }

    const formattedStart = start.toISOString().split('T')[0];
    const formattedEnd = end.toISOString().split('T')[0];

    // SQL query to get the last recorded GPS coordinates within the time range
    const gpsQuery = `
      SELECT latitude, longitude, timestamp
      FROM hydralytica_dashboard.dya_telematics_units_data
      WHERE timestamp >= ? AND timestamp <= ? 
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY timestamp DESC LIMIT 1;
    `;
    const gpsParams = [formattedStart, formattedEnd];

    // Get a connection from the pool to fetch the GPS data
    const connectionGpsData = await pool.getConnection();
    const gpsResults = await connectionGpsData.query(gpsQuery, gpsParams);
    connectionGpsData.release();

    // If no GPS data is found in the given time range, look for the nearest valid coordinates
    if (gpsResults.length === 0) {
      const nearestGpsQuery = `
        SELECT latitude, longitude, timestamp
        FROM hydralytica_dashboard.dya_telematics_units_data
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY timestamp DESC LIMIT 1;
      `;
      const nearestGpsResults = await pool.query(nearestGpsQuery);
      if (nearestGpsResults.length > 0) {
        return res.json({
          message: 'No valid GPS coordinates found within the selected range, returning nearest valid coordinates.',
          coordinates: nearestGpsResults[0]
        });
      }
    }

    // If valid coordinates were found, return them
    if (gpsResults.length > 0) {
      return res.json({
        coordinates: gpsResults[0]
      });
    } else {
      return res.status(404).json({ message: 'No valid GPS coordinates found' });
    }
  } catch (err) {
    console.error('Error fetching last recorded GPS coordinates:', err.message);
    res.status(500).json({ error: `Error fetching GPS coordinates: ${err.message}` });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
