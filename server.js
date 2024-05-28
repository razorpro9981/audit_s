const express = require("express");
const oracledb = require("oracledb");
const dotenv = require("dotenv");
const mysql = require("mysql");
const queries = require("./queries");
const cors = require("cors");
const axios = require("axios"); // Make sure to install axios: npm install axios
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const intervalInSeconds = 5 * 60 * 1000; // 2 minutes

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = 3010;
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// const pgConfig = {
//   user: process.env.POSTGRES_USER,
//   password: process.env.POSTGRES_PASSWORD,
//   host: process.env.POSTGRES_HOST,
//   database: process.env.POSTGRES_DATABASE,
//   port: process.env.POSTGRES_PORT,
// };

// MySQL Database Configuration
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

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

// Function to store data in MySQL
async function storeDataInMySQL(data) {
  const connection = mysql.createConnection(mysqlConfig);

  try {
    await new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          console.error("Error connecting to MySQL:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Set autocommit
    connection.query("SET autocommit = 1");

    const tableName = "audit"; // Replace with your actual table name
    const sessionIdColumn = "sessionid"; // Replace with your actual rnum column name
    const uuidColumn = "uuid"; // Replace with your actual UUID column name

    // Check if there is already a record with the same sessionid
    const existingSessionIdQuery = `SELECT ${uuidColumn} FROM ${tableName} WHERE ${sessionIdColumn} = ? LIMIT 1`;

    const existingSessionIdResult = await new Promise((resolve, reject) => {
      connection.query(
        existingSessionIdQuery,
        [data[sessionIdColumn]],
        (err, result) => {
          if (err) {
            console.error("Error checking existing sessionid:", err);
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });

    if (existingSessionIdResult.length === 0) {
      // No record with the same sessionid found, proceed with insertion

      // Check if the data already exists based on the UUID
      const existingDataQuery = `SELECT 1 FROM ${tableName} WHERE ${uuidColumn} = ? LIMIT 1`;

      const result = await new Promise((resolve, reject) => {
        connection.query(
          existingDataQuery,
          [data[uuidColumn]],
          (err, result) => {
            if (err) {
              console.error("Error checking existing data:", err);
              reject(err);
            } else {
              resolve(result);
            }
          }
        );
      });

      if (result.length === 0) {
        // Data does not exist, proceed with insertion
        // Generate a UUID for the new data
        data[uuidColumn] = uuidv4();

        // Exclude the 'rn' column from the data before insertion
        delete data.rn;

        const insertQuery = `INSERT INTO ${tableName} SET ?`;

        await new Promise((resolve, reject) => {
          connection.query(insertQuery, data, (err, result) => {
            if (err) {
              console.error("Error inserting data into MySQL:", err);
              reject(err);
            } else {
              console.log("Data inserted into MySQL successfully:", result);
              resolve(result);
            }
          });
        });
      } else {
        // Data with the same UUID already exists, do not insert
        console.log("Data already exists in MySQL, skipping insertion.");
      }
    } else {
      // Record with the same sessionid found, do not insert
      console.log(
        "Record with the same sessionid already exists in MySQL, skipping insertion."
      );
    }
  } finally {
    // Always close the connection, whether there's an error or not
    connection.end();
  }
}

app.get("/api/viewData", async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);

    // Call createTable function to ensure the table exists
    await createTable(mysql.createConnection(mysqlConfig), "audit");

    const page = req.query.page || 1;
    const pageSize = 100;
    const offset = (page - 1) * pageSize;

    const query = queries.x4; // Use the stored query

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

app.get("/api/os_usernames", (req, res) => {
  const mysqlConnection = mysql.createConnection(mysqlConfig); // Establish MySQL connection

  const query = "SELECT DISTINCT OS_USERNAME FROM audit";

  mysqlConnection.query(query, (err, results) => {
    if (err) {
      console.error("Error executing MySQL query: " + err.stack);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json(results);

    // Don't forget to close the connection after fetching the results
    mysqlConnection.end();
  });
});

app.get("/api/action_names", (req, res) => {
  const mysqlConnection = mysql.createConnection(mysqlConfig); // Establish MySQL connection

  const query = "select distinct ACTION_NAME FROM audit";

  mysqlConnection.query(query, (err, results) => {
    if (err) {
      console.error("Error executing MySQL query: " + err.stack);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json(results);

    // Don't forget to close the connection after fetching the results
    mysqlConnection.end();
  });
});
app.get("/api/getMySQLData", async (req, res) => {
  try {
    const connection = mysql.createConnection(mysqlConfig);

    connection.connect(async (err) => {
      if (err) {
        console.error("Error connecting to MySQL:", err);
        return res.status(500).send("Internal Server Error");
      }

      const tableName = "audit"; // Replace with your actual table name
      const query = `SELECT * FROM ${tableName}`;

      connection.query(query, (err, result) => {
        connection.end(); // Close the connection

        if (err) {
          console.error("Error retrieving MySQL data:", err);
          return res.status(500).send("Internal Server Error");
        }

        return res.status(200).json(result);
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

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
setInterval(fetchData, intervalInSeconds);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
