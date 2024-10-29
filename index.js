import express from "express";
import cors from "cors";
import Pool from "pg-pool";
import dotenv from "dotenv";
import multer from "multer";


import fs from "fs";

dotenv.config();

const app = express();

const router = express.Router();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT;

// Create uploads directory if it doesn't exist

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // specify the folder to save images
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // store files with unique names
  },
});

// Initialize multer with storage settings
const upload = multer({ storage: storage });
app.use("/uploads", express.static("uploads"));

app.listen(port, () => {
  console.log(`App is listening at port ${port}`);
});

const postgresPool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  max: parseInt(process.env.DB_MAX_CLIENTS, 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Function to connect to the PostgreSQL database

const connectToDatabase = async () => {
  try {
    const connection = await postgresPool.connect();
    console.log("Succesfully connected to database");
    connection.release();
  } catch (error) {
    console.error("Error connecting to the database:", error.message);
  }
};

connectToDatabase();

// GET method to get all the students
app.get("/students", async (req, res) => {
  try {
    const result = await postgresPool.query(`
         SELECT s.*, c.class_name, c.section, f.amount AS fee
         FROM student s
         JOIN class c ON s.class_id = c.class_id
         LEFT JOIN fee f ON s.student_id = f.student_id;  -- Assuming you have a fee table linked to student
     `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching students", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching students." });
  }
});

// POST endpoint to add a new student with an image
app.post("/students", upload.single("image"), async (req, res) => {
  const { name, age, guardian_name, class_id, address, phonenumber } = req.body;
  const imagePath = req.file ? req.file.path : null; // Get the path of the uploaded image, if available

  try {
    // Insert student record into the database
    const result = await postgresPool.query(
      `
         INSERT INTO student (name, age, guardian_name, class_id, address, phonenumber, image)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;  
     `,
      [name, age, guardian_name, class_id, address, phonenumber, imagePath]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding student", error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the student." });
  }
});

// getting all classes
app.get("/classes", async (req, res) => {
  try {
    const result = await postgresPool.query("SELECT * FROM class;");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching classes", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching classes." });
  }
});

app.post("/classes", async (req, res) => {
  const { class_name, section } = req.body;
  try {
    const newClass = await postgresPool.query(
      "INSERT INTO class (class_name, section) VALUES ($1, $2) RETURNING *",
      [class_name, section]
    );
    res.json(newClass.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Update a class
app.put("/classes/:id", async (req, res) => {
  const { id } = req.params;
  const { class_name, section } = req.body;
  try {
    const updateClass = await postgresPool.query(
      "UPDATE class SET class_name = $1, section = $2 WHERE class_id = $3 RETURNING *",
      [class_name, section, id]
    );
    res.json(updateClass.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Delete a class
app.delete("/classes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await postgresPool.query("DELETE FROM class WHERE class_id = $1", [id]);
    res.json({ message: "Class deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// fee routes
app.get("/student/:student_id", async (req, res) => {
  const { student_id } = req.params;
  try {
    const result = await postgresPool.query(
      "SELECT * FROM fee WHERE student_id = $1",
      [student_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.post("/fee", async (req, res) => {
  const { student_id, amount, payment_date } = req.body; 
  try {
    const newFee = await postgresPool.query(
      "INSERT INTO fee (student_id, amount, payment_date) VALUES ($1, $2, $3) RETURNING *",
      [student_id, amount, payment_date]
    );
    res.json(newFee.rows[0]);
  } catch (err) {
    console.error("Error saving fee:", err.message); // Log the error message for debugging
    res.status(500).send("Server error");
  }
});

// Update a fee
app.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { student_id, amount, payment_date } = req.body;
  try {
    const updatedFee = await postgresPool.query(
      "UPDATE fee SET student_id = $1, amount = $2, payment_date = $3 WHERE fee_id = $4 RETURNING *",
      [student_id, amount, payment_date, id]
    );
    res.json(updatedFee.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Delete a fee
app.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await postgresPool.query("DELETE FROM fee WHERE fee_id = $1", [id]);
    res.json({ message: "Fee deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Create attendance record
app.post("/attendance", async (req, res) => {
  const { student_id, class_id, attendance_date, status } = req.body;
  try {
    const newAttendance = await postgresPool.query(
      "INSERT INTO attendance (student_id, class_id, attendance_date, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [student_id, class_id, attendance_date, status]
    );
    res.json(newAttendance.rows[0]);
  } catch (err) {
    console.error("Error saving attendance:", err.message);
    res.status(500).send("Server error");
  }
});

// Get all attendance records with student details
app.get("/attendance", async (req, res) => {
  try {
    const attendanceRecords = await postgresPool.query(`
            SELECT 
                a.attendance_id,
                s.name AS student_name,
                c.class_name,
                a.attendance_date,
                a.status,
                s.image AS student_image
            FROM 
                attendance a
            JOIN 
                student s ON a.student_id = s.student_id
            JOIN 
                class c ON s.class_id = c.class_id
        `);

    if (attendanceRecords.rows.length === 0) {
      return res.status(404).json({ error: "No attendance records found" });
    }
    res.json(attendanceRecords.rows);
  } catch (err) {
    console.error("Error fetching attendance records:", err.message);
    res.status(500).send("Server error");
  }
});
