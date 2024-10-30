import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Pool from "pg-pool"

dotenv.config();

const app = express();

app.use(cors())
const port = 3000;

const postgresPool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  max: parseInt(process.env.DB_MAX_CLIENTS, 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});

// Function to connect to the PostgreSQL database
const connectToDatabase = async () => {
  try {
    const connection = await postgresPool.connect(); // Get a client from the pool
    console.log("Connected to the database successfully");
    connection.release(); // Release connection back to the pool
  } catch (error) {
    console.error("Error connecting to the database:", error.message);
  }
};

connectToDatabase();

app.listen(port, () => {
  console.log(`Server is listening at port ${port}`);
});

app.get("/api/students", async (req, res) => {
  try {
      const result = await postgresPool.query(`
          SELECT 
              s.id,
              s.name,
              s.father_name,
              s.address,
              s.phone_number,
              s.email,
              s.roll_no,
              c.class_name,
              f.amount AS fee_amount,
              f.due_date AS fee_due_date,
              f.status AS fee_status
          FROM 
              student s
          LEFT JOIN 
              class c ON s.class_id = c.class_id
          LEFT JOIN 
              fee f ON s.fee_id = f.fee_id
      `);

      if (result.rows.length === 0) {
          return res.status(404).json({ error: "No students found" });
      }

      return res.status(200).json(result.rows);
  } catch (error) {
      console.error("Error fetching students:", error.message);
      res.status(500).json({ error: "An error occurred while fetching students." });
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


app.get("/api/students/:student_id/fees", async (req, res) => {
  const studentId = req.params.student_id;

  try {
    const result = await postgresPool.query(`
      SELECT * FROM fee WHERE student_id = $1;
    `, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No fees found for this student." });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching fees:", error.message);
    return res.status(500).json({ error: "An error occurred while fetching fees." });
  }
});

app.get("/api/fees", async (req, res) => {
  try {
    const result = await postgresPool.query(`
      SELECT 
        fee.fee_id,
        fee.fee_amount,
        fee.fee_due_date,
        fee.fee_status,
        student.name AS student_name,
        student.roll_no,
        class.class_name,
        class.section
      FROM fee
      JOIN student ON fee.student_id = student.id
      JOIN class ON student.class_id = class.class_id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No fee records found" });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching fees:", error.message);
    res.status(500).json({ error: "An error occurred while fetching fees." });
  }
});
