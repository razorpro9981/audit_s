const oracledb = require("oracledb");
const mysql = require("mysql");
const dotenv = require("dotenv");

dotenv.config(); // Load environment variables from .env file

// Oracle DB connection configuration
const dbConfig = {
  privilege: oracledb.SYSDBA,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
};

// MySQL DB connection configuration
const mySqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

// Establish a connection to the Oracle database
oracledb
  .getConnection(dbConfig)
  .then(async (connection) => {
    try {
      // Query to select all data from the table (replace 'your_table' with your actual table name)
      const query = `SELECT COLUMN_NAME
FROM DBA_TAB_COLUMNS
WHERE TABLE_NAME = 'UNIFIED_AUDIT_TRAIL' 
ORDER by 'ID'   `;

      // Execute the query
      const result = await connection.execute(query);

      // Log the results
      console.log(result.rows);
    } catch (error) {
      console.error("Error executing query:", error);
    } finally {
      // Close the connection once done
      await connection.close();
    }
  })
  .catch((error) => {
    console.error("Error connecting to Oracle database:", error);
  });

// Establish a connection to the MySQL database
const connection = mysql.createConnection(mySqlConfig);

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database:", err);
    return;
  }
  console.log("MySQL DB connection established successfully");

  // Perform your database operations here if needed

  // Close the connection when done (optional)
});
// Assuming your MySQL connection is already established using the `connection` object

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

connection.query(createTableQuery, (err, results) => {
  if (err) {
    console.error("Error creating table:", err);
  } else {
    console.log("Table created successfully");
  }

  // Close the connection when done (optional)
  connection.end();
});
