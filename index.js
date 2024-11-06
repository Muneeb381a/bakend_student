import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Pool from "pg-pool";
import multer from "multer";
import { v2 as cloudinary} from "cloudinary";
import path from "path";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
 });

const storage = multer.memoryStorage();
const upload = multer({storage});



const app = express();

app.use(cors());
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
              s.profile_pic,
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
          ORDER BY
              s.id ASC
      `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No students found" });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching students:", error.message);
    res
      .status(500)
      .json({ error: "An error occurred while fetching students." });
  }
});

app.get("/class", async (req, res) => {
  try {
    const result = await postgresPool.query("SELECT * FROM class");

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No class found" });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching class:", error.message);
    res
      .status(500)
      .json({ error: "An error occurred while fetching classes." });
  }
});

app.get("/api/students/:student_id/fees", async (req, res) => {
  const studentId = req.params.student_id;

  try {
    const result = await postgresPool.query(
      `
      SELECT * FROM fee WHERE student_id = $1;
    `,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No fees found for this student." });
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching fees:", error.message);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching fees." });
  }
});

app.get("/api/fees", async (req, res) => {
  try {
    const query = `
      SELECT 
        s.name AS student_name, 
        s.roll_no,
        c.class_name,
        c.section,
        f.amount AS fee_amount, 
        f.due_date AS fee_due_date, 
        f.status AS fee_status
      FROM 
        fee f
      JOIN 
        student s ON s.id = f.student_id
      JOIN 
        class c ON c.class_id = s.class_id;
    `;
    const result = await postgresPool.query(query);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No fee records found" });
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching fees:", error.message);
    res.status(500).json({ error: "An error occurred while fetching fees." });
  }
});

// getting all teachers

app.get("/api/teachers", async (req, res) => {
  try {
    const result = await postgresPool.query("SELECT * FROM teacher;");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching class", error);
    res.status(500).json({ error: "An error occured while fetching teachers" });
  }
});

// getting all the subjects

app.get("/api/subjects", async (req, res) => {
  try {
    const result = await postgresPool.query(`
        SELECT
          subject.subject_id,
          subject.subject_name,
          teacher.name AS teacher_name,
          subject.description
          FROM
            subject
          JOIN
            teacher
          ON
            subject.teacher_id = teacher.teacher_id
      `);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No Subjects Found" });
    }
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error while fething subjects", error.message);
    res.status(500).json({ error: "Error occured while fething subjects" });
  }
});

// POST route for student
app.post("/api/student", upload.single("profile_pic"), async (req, res) => {
  const { class_id, address, phone_number, email, roll_no, name, father_name } =
    req.body;

  // Validate required fields
  const requiredFields = {
    address,
    phone_number,
    email,
    roll_no,
    name,
    father_name,
  };

  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  let profilePicUrl = null;

  // If a profile picture is uploaded, upload it to Cloudinary
  if (req.file) {
    // Validate file type (ensure it's an image)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and GIF are allowed." });
    }

    try {
      const uploadToCloudinary = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "profile_pic",
              public_id: Date.now().toString(),
              resource_type: "image",
              format: path.extname(req.file.originalname).substring(1) || "jpg",
            },
            (error, result) => {
              if (error) {
                reject(error);  // If there's an error, reject the promise
              } else {
                resolve(result.secure_url);  // If successful, resolve the promise
              }
            }
          );
          stream.end(req.file.buffer); // End the stream and upload the file
        });

      profilePicUrl = await uploadToCloudinary();  // Wait for Cloudinary to finish uploading
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);  // Log the error
      return res.status(500).json({ error: `Image upload failed: ${error.message}` });  // Send error response
    }
  }

  // SQL query to insert student data into the database
  const query = `
    INSERT INTO student (class_id, address, phone_number, email, roll_no, name, father_name, profile_pic)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`;

  const values = [
    class_id || null,  // Allow class_id to be optional
    address,
    phone_number,
    email,
    roll_no,
    name,
    father_name,
    profilePicUrl,  // URL of the uploaded profile picture (or null if no image uploaded)
  ];

  try {
    const result = await postgresPool.query(query, values);
    return res.status(201).json(result.rows[0]);  // Return the newly created student data
  } catch (error) {
    console.error("Error while adding the student:", error.message);  // Log the error
    return res.status(500).json({
      error: "An error occurred while creating the student.",
    });  // Send error response
  }
});

app.put("/api/student/:id", upload.single("profile_pic"), async (req, res) => {
  const { id } = req.params; // Get the student ID from the URL parameter
  const { class_id, address, phone_number, email, roll_no, name, father_name } = req.body;

  // Validate required fields (except for profile_pic, as it is optional)
  const requiredFields = { address, phone_number, email, roll_no, name, father_name };
  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Start with the existing profilePicUrl
  let profilePicUrl = null;

  // If a new profile picture is uploaded, upload it to Cloudinary
  if (req.file) {
    // Validate file type (ensure it's an image)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and GIF are allowed." });
    }

    try {
      // Upload the new image to Cloudinary
      const uploadToCloudinary = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "profile_pic",
              public_id: Date.now().toString(),
              resource_type: "image",
              format: path.extname(req.file.originalname).substring(1) || "jpg",
            },
            (error, result) => {
              if (error) {
                reject(error);  // Reject if there's an error
              } else {
                resolve(result.secure_url);  // Resolve with the image URL
              }
            }
          );
          stream.end(req.file.buffer);  // End the stream to upload the file
        });

      profilePicUrl = await uploadToCloudinary();  // Get the Cloudinary image URL
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);  // Log the error
      return res.status(500).json({ error: `Image upload failed: ${error.message}` });
    }
  }

  // If no new profile picture is uploaded, keep the existing one
  if (!profilePicUrl) {
    // Query to get the current student data (including profile pic URL)
    const getStudentQuery = 'SELECT profile_pic FROM student WHERE id = $1';
    try {
      const studentResult = await postgresPool.query(getStudentQuery, [id]);
      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      profilePicUrl = studentResult.rows[0].profile_pic;  // Use the existing profile pic URL
    } catch (error) {
      console.error("Error fetching student data:", error.message);
      return res.status(500).json({ error: "An error occurred while fetching student data." });
    }
  }

  // SQL query to update the student data in the database
  const updateQuery = `
    UPDATE student
    SET class_id = $1, address = $2, phone_number = $3, email = $4, roll_no = $5, name = $6, father_name = $7, profile_pic = $8
    WHERE id = $9
    RETURNING *`;

  const values = [
    class_id || null,  // Allow class_id to be optional
    address,
    phone_number,
    email,
    roll_no,
    name,
    father_name,
    profilePicUrl,  // Updated profile picture URL (or existing one if not changed)
    id,  // Student ID to identify the record
  ];

  try {
    const result = await postgresPool.query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    return res.status(200).json(result.rows[0]);  // Return the updated student data
  } catch (error) {
    console.error("Error while updating the student:", error.message);  // Log the error
    return res.status(500).json({ error: "An error occurred while updating the student." });
  }
});


// Get student throgh id
app.get("/api/student/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await postgresPool.query("SELECT * FROM student WHERE id = $1", [id]);

    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(404).json({ error: "Student not found" });
    }
  } catch (error) {
    console.error("Error fetching student data:", error.stack); // Log error stack for detailed error
    res.status(500).json({ error: "An error occurred while fetching student data" });
  }
});



// Post method for class
app.post("/api/class", async (req, res) => {
  const { class_name, section } = req.body;

  // Validate required fields
  const requiredFields = { class_name, section };
  const missingFields = Object.entries(requiredFields)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const query = `
    INSERT INTO class (class_name, section)
    VALUES ($1, $2)
    RETURNING *`;

  const values = [class_name, section];

  try {
    const result = await postgresPool.query(query, values);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error while adding the class:", error.message);
    return res.status(500).json({
      error: "An error occurred while creating the class.",
    });
  }
});

// POSt method for fee
app.post("/api/fee", async (req, res) => {
  const { student_id, amount, due_date, status } = req.body; 

  const query = `
    INSERT INTO fee (student_id, amount, due_date, status) 
    VALUES ($1, $2, $3, $4)
    RETURNING fee_id; 
  `;

  try {
    const result = await postgresPool.query(query, [
      student_id,
      amount,
      due_date,
      status,
    ]);
    res
      .status(201)
      .json({
        fee_id: result.rows[0].fee_id,
        message: "Fee submitted successfully!",
      });
  } catch (error) {
    console.error("Error submitting fee:", error);
    res
      .status(500)
      .json({ error: "An error occurred while submitting the fee." });
  }
});

// Get student by id

app.get("/api/students/:id", async (req, res) => {
  const studentId = req.params.id;

  const query = `
      SELECT s.id, s.name, s.father_name, s.roll_no, s.email, c.class_name, c.section
      FROM student s
      LEFT JOIN class c ON s.class_id = c.class_id 
      WHERE s.id = $1
  `;

  try {
    const result = await postgresPool.query(query, [studentId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "Student not found" });
    }
  } catch (error) {
    console.error("Error fetching student details:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching student details." });
  }
});
