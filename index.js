import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectToDatabase } from "./utils/db.js";
import Pool from "pg-pool"

dotenv.config();

const app = express();

app.use(cors())
const port = 3000;

// const postgresPool = new Pool({
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   host: process.env.DB_HOST,
//   port: parseInt(process.env.DB_PORT, 10),
//   max: parseInt(process.env.DB_MAX_CLIENTS, 10),
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 5000,
//   ssl: { rejectUnauthorized: false },
// });

// // Function to connect to the PostgreSQL database
// const connectToDatabase = async () => {
//   try {
//     const connection = await postgresPool.connect(); // Get a client from the pool
//     console.log("Connected to the database successfully");
//     connection.release(); // Release connection back to the pool
//   } catch (error) {
//     console.error("Error connecting to the database:", error.message);
//   }
// };

connectToDatabase();

app.listen(port, () => {
  console.log(`Server is listening at port ${port}`);
});

app.get("/", async (req, res) => {
  try {
    const result = await postgresPool.query("SELECT * FROM student");

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No students found" });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching students:", error.message);
    return res.status(500).json({ error: "An error occurred while fetching students." });
  }
});


app.get("/class", async(req, res) => {
  try {
    const result = await postgresPool.query("SELECT * FROM class");

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No class found" });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching class:", error.message);
    res.status(500).json({ error: "An error occurred while fetching classes." });
  }
});


