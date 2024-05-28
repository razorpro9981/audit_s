// Import required libraries
const express = require("express");
const oracledb = require("oracledb");
const dotenv = require("dotenv");
const mysql = require("mysql2");
const queries = require("./queries");
const cors = require("cors");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// Load environment variables from .env file
dotenv.config();

// Create an Express app
const app = express();
const port = 3010;

// Enable CORS
app.use(cors());

// MySQL Database Configuration with Connection Pool
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 10, // Set the connection limit to 10
  waitForConnections: true,
  queueLimit: 0,
});

// Oracle Database Configuration
const dbConfig = {
  privilege: oracledb.SYSDBA,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
};

// Middleware to validate API key
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).send("Invalid API Key");
  }
  next();
};

app.use(apiKeyMiddleware);

// Function to create the table dynamically
async function createTable(connection, tableName) {
  const createTableQuery = queries.createTable.replace(
    "${tableName}",
    tableName
  );

  connection.query(createTableQuery, (err, result) => {
    if (err) {
      console.error("Error creating table, already exists");
    } else {
      console.log("Table created successfully:", result);
    }
  });
}

// Function to store data in MySQL using connection pool
async function storeDataInMySQL(data) {
  const pool = mysqlPool.promise();

  try {
    const connection = await pool.getConnection();

    try {
      await connection.query("SET autocommit = 1");

      const tableName = "audit";
      const sessionIdColumn = "event_timestamp";
      const uuidColumn = "uuid";

      const existingSessionIdQuery = `SELECT ${uuidColumn} FROM ${tableName} WHERE ${sessionIdColumn} = ? LIMIT 1`;

      const [existingSessionIdResult] = await connection.query(
        existingSessionIdQuery,
        [data[sessionIdColumn]]
      );

      if (existingSessionIdResult.length === 0) {
        const existingDataQuery = `SELECT 1 FROM ${tableName} WHERE ${uuidColumn} = ? LIMIT 1`;

        const [result] = await connection.query(existingDataQuery, [
          data[uuidColumn],
        ]);

        if (result.length === 0) {
          data[uuidColumn] = uuidv4();
          delete data.rn;

          const insertQuery = `INSERT INTO ${tableName} SET ?`;

          const [insertResult] = await connection.query(insertQuery, [data]);

          console.log("Data inserted into MySQL successfully:", insertResult);
        } else {
          console.log("Data already exists in MySQL, skipping insertion.");
        }
      } else {
        console.log(
          "Record with the same sessionid already exists in MySQL, skipping insertion."
        );
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error connecting to MySQL:", error);
  }
}

// Endpoint to fetch data from Oracle, store it in MySQL, and return the result
app.get("/api/viewData", async (req, res) => {
  try {
    // Get Oracle database connection
    const connection = await oracledb.getConnection(dbConfig);

    // Create MySQL table if it does not exist
    await createTable(mysql.createConnection(mysqlPool.config), "audit");

    // Get page and set default values
    const page = req.query.page || 1;
    const pageSize = 100;
    const offset = (page - 1) * pageSize;

    // Get Oracle query from queries module
    const query = queries.x4;

    const binds = { maxRows: offset + pageSize, offset: offset + 1 };
    const result = await connection.execute(query, binds);

    if (result.rows) {
      const response = [];
      for (let i = 0; i < result.rows.length; i++) {
        const rowData = {};

        for (let x = 0; x < result.metaData.length; x++) {
          const columnName = result.metaData[x].name.toLowerCase();
          const columnValue = result.rows[i][x];
          rowData[columnName] = columnValue;
        }

        // Insert data into MySQL (checking for existence first)
        await storeDataInMySQL(rowData);

        response.push(rowData);
      }

      return res.status(200).send(response);
    }

    await connection.close();
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to retrieve data from MySQL
app.get("/api/getMySQLData", async (req, res) => {
  try {
    const [rows, fields] = await mysqlPool
      .promise()
      .query("SELECT * FROM audit");

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error retrieving MySQL data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Function to fetch data using Axios every 10 seconds
function fetchData() {
  axios
    .get("http://localhost:3010/api/viewData", {
      headers: {
        "x-api-key": process.env.API_KEY,
      },
    })
    .then((response) => {
      console.log("Data fetched successfully");
    })
    .catch((error) => {
      console.error("Error fetching data:", error.message);
    });
}

// Call fetchData every 10 seconds
setInterval(fetchData, 10 * 1000);

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
