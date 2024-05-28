const express = require("express");
const oracledb = require("oracledb");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const queries = require("./queries");
const cors = require("cors");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
const port = 3010;
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const intervalInSeconds = 50000;

const pgConfig = {
  user: "postgres",
  host: "localhost",
  database: "audit",
  password: "1234",
  port: 5432,
};
const pool = new Pool(pgConfig);
pool
  .connect()
  .then(() => {
    console.log("Connected to PostgreSQL database");
  })
  .catch((err) => {
    console.error("Error connecting to PostgreSQL database", err);
  });

const dbConfig = {
  privilege: oracledb.SYSDBA,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
};

const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).send("Invalid API Key");
  }
  next();
};

app.use(apiKeyMiddleware);

app.get("/api/viewData", async (req, res) => {
  try {
    const connection = await oracledb.getConnection(dbConfig);

    const page = req.query.page || 1;
    const pageSize = 100;
    const offset = (page - 1) * pageSize;

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

        response.push(rowData);
      }

      // Insert fetched data into PostgreSQL database
      await insertDataIntoPostgres(response);

      return res.status(200).send(response);
    }
    await connection.close();
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

async function insertDataIntoPostgres(data) {
  let client;
  try {
    client = await pool.connect();
    for (let i = 0; i < data.length; i++) {
      const rowData = data[i];
      function removeSpaceAfterText(sqlText) {
        if (sqlText === null) return null; // Handle null case
        // Replace null bytes with a placeholder character
        const sanitizedSqlText = sqlText.replace(/\x00/g, "?");
        // Remove any space character immediately after the text
        return sanitizedSqlText.replace(/(UNLOCK)\s+/g, "$1");
      }

      const sanitizedSqlText = removeSpaceAfterText(rowData.sql_text);

      const query = `
          INSERT INTO audit (audit_type, sessionid, os_username, userhost, terminal, 
            instance_id, dbid, authentication_type, dbusername, client_program_name, 
            entry_id, statement_id, event_timestamp, event_timestamp_utc,
            action_name,return_code, os_process, transaction_id, scn, object_schema, sql_text, rnum, rn)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
            $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        `;
      const values = [
        rowData.audit_type,
        rowData.sessionid,
        rowData.os_username,
        rowData.userhost,
        rowData.terminal,
        rowData.instance_id,
        rowData.dbid,
        rowData.authentication_type,
        rowData.dbusername,
        rowData.client_program_name,
        rowData.entry_id,
        rowData.statement_id,
        rowData.event_timestamp,
        rowData.event_timestamp_utc,
        rowData.action_name,
        rowData.return_code,
        rowData.os_process,
        rowData.transaction_id,
        rowData.scn,
        rowData.object_schema,
        sanitizedSqlText,
        rowData.rn,
        rowData.rnum,
      ];
      await client.query(query, values);
    }
    console.log("Data inserted into PostgreSQL database successfully!");
  } catch (error) {
    console.error("Error inserting data into PostgreSQL database:", error);
  } finally {
    client.release();
  }
}

app.get("/api/os_usernames", async (req, res) => {
  const client = await pool.connect();
  try {
    const query = "SELECT DISTINCT OS_USERNAME FROM audit";
    const { rows } = await client.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error executing PostgreSQL query:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.get("/api/action_names", async (req, res) => {
  const client = await pool.connect();
  try {
    const query = "SELECT DISTINCT ACTION_NAME FROM audit";
    const { rows } = await client.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error executing PostgreSQL query:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.get("/api/getPostgreSQLData", async (req, res) => {
  const client = await pool.connect();
  try {
    const query = "SELECT * FROM audit";
    const { rows } = await client.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error retrieving PostgreSQL data:", error);
    res.status(500).send("Internal Server Error");
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
