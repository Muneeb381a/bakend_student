import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Pool from "pg-pool";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });



const app = express();

app.use(cors());
const port = 3000;
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const postgresPool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  max: parseInt(process.env.DB_MAX_CLIENTS, 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
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

// geeting students

app.get("/api/students", async (req, res) => {
  const query = `
    SELECT 
      s.id,
      s.class_id,
      s.name,
      s.father_name,
      s.mother_name,
      s.father_cnic,
      s.mother_cnic,
      s.phone_number_with_code,
      s.whatsapp_number,
      s.email,
      s.roll_no,
      s.dob,
      s.age,
      s.gender,
      s.blood_group,
      s.religion,
      s.nationality,
      s.previous_class,
      s.previous_school,
      s.certificates,
      s.disability,
      s.hobbies,
      s.emergency_contact_name,
      s.emergency_contact_relationship,
      s.emergency_contact_number,
      s.address_1,
      s.address_2,
      s.profile_pic,
      s.admission_date,
      c.class_name, 
      f.amount, 
      f.status 
    FROM student s
    LEFT JOIN class c ON s.class_id = c.id
    LEFT JOIN fee f ON s.id = f.student_id; 
  `;

  try {
    const result = await postgresPool.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error while fetching students:", error.message);
    return res.status(500).json({ error: "An error occurred while fetching the students." });
  }
});


// getting fee
app.get("/api/fees", async (req, res) => {
  try {
    // Base query to fetch fee data with joins
    const query = `
      SELECT 
        s.name AS student_name, 
        s.roll_no,
        c.class_name,
        c.section,
        f.fee_type,
        f.amount AS fee_amount, 
        f.due_date AS fee_due_date, 
        f.status AS fee_status
      FROM 
        fee f
      JOIN 
        student s ON s.id = f.student_id
      JOIN 
        class c ON c.id = s.class_id;
    `;

    // Execute the query
    const result = await postgresPool.query(query);

    // Check if any records were returned
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No fee records found." });
    }

    // Return the results
    return res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching fees:", error.message);
    res.status(500).json({ error: "An error occurred while fetching fees." });
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



// POST route for student
app.post("/api/student", upload.fields([{ name: "profile_pic" }, { name: "certificates" }]), async (req, res) => {
  const {
    class_id,
    address_1,
    address_2,
    phone_number_with_code,
    whatsapp_number,
    email,
    roll_no,
    name,
    father_name,
    mother_name,
    father_cnic,
    mother_cnic,
    dob,
    age,
    gender,
    blood_group,
    religion,
    nationality,
    previous_class,
    previous_school,
    disability,
    hobbies,
    emergency_contact_name,
    emergency_contact_relationship,
    emergency_contact_number,
    admission_date,
    fee_id,
  } = req.body;

  // Validate required fields (add the actual field checks)
  const requiredFields = { class_id, address_1, phone_number_with_code, email, name, father_name, dob };
  const missingFields = Object.entries(requiredFields).filter(([_, value]) => !value).map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` });
  }

  const uploadToCloudinary = async (file, folder) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: Date.now().toString(),
          resource_type: "image",
          timeout: 60000 // Increased timeout to 60 seconds
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error); // Log the error for debugging
            reject(new Error("File upload failed: " + error.message));
          } else {
            console.log("Cloudinary upload successful:", result.secure_url); // Log success for reference
            resolve(result.secure_url);
          }
        }
      );

      if (!file || !file.buffer) {
        reject(new Error("Invalid file or file buffer"));
        return;
      }

      stream.end(file.buffer); // Pass the file buffer to the stream
    });
  };


  let profilePicUrl = null;
  let certificatesUrl = null;

  try {
    if (req.files.profile_pic && req.files.profile_pic.length > 0) {
      profilePicUrl = await uploadToCloudinary(req.files.profile_pic[0], "profile_pic");
    }

    if (req.files.certificates && req.files.certificates.length > 0) {
      const certificateUrls = await Promise.all(
        req.files.certificates.map(file => uploadToCloudinary(file, "certificates"))
      );
      certificatesUrl = JSON.stringify(certificateUrls);
    }
  } catch (error) {
    console.error("Error uploading files to Cloudinary:", error);
    return res.status(500).json({ error: "File upload failed" });
  }

  const query = `
    INSERT INTO student (
      class_id, address_1, address_2, phone_number_with_code, whatsapp_number, email, 
      roll_no, name, father_name, mother_name, father_cnic, mother_cnic, dob, age,gender, 
      blood_group, religion, nationality, previous_school, previous_class, certificates, 
      disability, hobbies, emergency_contact_name, emergency_contact_relationship, 
      emergency_contact_number, profile_pic, fee_id, admission_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
      $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
    ) RETURNING *`;

  const values = [
    class_id || null,
    address_1,
    address_2 || null,
    phone_number_with_code,
    whatsapp_number || null,
    email,
    roll_no,
    name,
    father_name,
    mother_name,
    father_cnic,
    mother_cnic,
    dob,
    age,
    gender,
    blood_group || null,
    religion || null,
    nationality || null,
    previous_school || null,
    previous_class || null,
    certificatesUrl || null,
    disability || null,
    hobbies || null,
    emergency_contact_name || null,
    emergency_contact_relationship || null,
    emergency_contact_number || null,
    profilePicUrl || null,
    fee_id || null,
    admission_date || null,
  ];

  try {
    const result = await postgresPool.query(query, values);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error while adding the student:", error);
    return res.status(500).json({ error: "An error occurred while creating the student." });
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

// get classes
app.get("/api/class", async (req, res) => {
  const query = `SELECT * FROM class`;

  try {
    const result = await postgresPool.query(query);
    return res.status(200).json(result.rows); 
  } catch (error) {
    console.error("Error while fetching classes:", error.message);
    return res.status(500).json({
      error: "An error occurred while fetching classes.",
    });
  }
});


// POSt method for fee
app.post("/api/fee", async (req, res) => {
  const { student_id, amount, due_date, status, type_id } = req.body; // Include type_id for fee type

  const query = `
    INSERT INTO fee (student_id, amount, due_date, status, type_id) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING fee_id; 
  `;

  try {
    const result = await postgresPool.query(query, [
      student_id,
      amount,
      due_date,
      status,
      type_id, 
    ]);
    res.status(201).json({
      fee_id: result.rows[0].fee_id,
      message: "Fee submitted successfully!",
    });
  } catch (error) {
    console.error("Error submitting fee:", error);
    res.status(500).json({ error: "An error occurred while submitting the fee." });
  }
});

// getting fee type
app.get("/api/fee-types", async (req, res) => {
  const query = "SELECT type_id, type_name FROM fee_types"; // Correct column names and table name

  try {
    const result = await postgresPool.query(query);
    res.status(200).json(result.rows); // Respond with the list of fee types
  } catch (error) {
    console.error("Error fetching fee types:", error);
    res.status(500).json({ error: "An error occurred while fetching fee types." });
  }
});



// Get student by id

app.get("/api/students/:studentId", async (req, res) => {
  const { studentId } = req.params;

  // SQL query to get student details with class and fee information
  const query = `
    SELECT
    s.id AS student_id,
    s.class_id,
    s.name,
    s.roll_no,
    c.class_name AS class_name,  
    f.amount AS fee_amount,
    f.status AS fee_status
  FROM student s
  LEFT JOIN class c ON s.class_id = c.id
  LEFT JOIN fee f ON s.id = f.student_id
  WHERE s.id = $1;
  `;

  try {
    const result = await postgresPool.query(query, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = result.rows[0];
    res.status(200).json({
      student_id: student.student_id,
      class_id: student.class_id,
      name: student.name,
      father_name: student.father_name,
      mother_name: student.mother_name,
      father_cnic: student.father_cnic,
      mother_cnic: student.mother_cnic,
      phone_number_with_code: student.phone_number_with_code,
      whatsapp_number: student.whatsapp_number,
      email: student.email,
      roll_no: student.roll_no,
      dob: student.dob,
      age: student.age,
      gender: student.gender,
      blood_group: student.blood_group,
      religion: student.religion,
      nationality: student.nationality,
      previous_class: student.previous_class,
      previous_school: student.previous_school,
      certificates: student.certificates,
      disability: student.disability,
      hobbies: student.hobbies,
      emergency_contact_name: student.emergency_contact_name,
      emergency_contact_relationship: student.emergency_contact_relationship,
      emergency_contact_number: student.emergency_contact_number,
      address_1: student.address_1,
      address_2: student.address_2,
      profile_pic: student.profile_pic,
      admission_date: student.admission_date,
      class_name: student.class_name || 'N/A',
      fee_amount: student.fee_amount || null,
      fee_status: student.fee_status || 'N/A'
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ error: "An error occurred while fetching the student." });
  }
});




// delete route for class
app.delete("/api/class/:id", async (req, res) => {
  const classId = req.params.id;
  try {
    const result = await postgresPool.query("DELETE FROM class WHERE id = $1 RETURNING *", [classId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Class not found" });
    }
    return res.status(200).json({ message: "Class deleted successfully" });
  } catch (error) {
    console.error("Error deleting class:", error);
    res.status(500).json({ error: "An error occurred while deleting the class." });
  }
});


//checking

app.post("/api/student/picture", upload.single("profile_pic"), async (req, res) => {
  const { student_id } = req.body;

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

  // SQL query to insert the image URL into the pictures table
  const query = `
    INSERT INTO pictures (student_id, image_url)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const values = [student_id, profilePicUrl];

  try {
    const result = await postgresPool.query(query, values);
    return res.status(201).json(result.rows[0]);  // Return the newly added image data
  } catch (error) {
    console.error("Error while adding the picture:", error.message);  // Log the error
    return res.status(500).json({
      error: "An error occurred while adding the picture.",
    });  // Send error response
  }
});



// attendance

app.post('/attendance', async (req, res) => {
  const { attendanceRecords } = req.body; // Array of { student_id, class_id, date, status, remarks }
  try {
      const query = `
          INSERT INTO attendance (student_id, class_id, date, status, remarks)
          VALUES ($1, $2, $3, $4, $5)
      `;
      const promises = attendanceRecords.map(record =>
          postgresPool.query(query, [
              record.student_id,
              record.class_id,
              record.date,
              record.status,
              record.remarks || null
          ])
      );
      await Promise.all(promises);
      res.status(201).json({ message: 'Attendance recorded successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// getting attendance detail
app.get('/attendance/class/:classId/date/:date', async (req, res) => {
  const { classId, date } = req.params;
  try {
      const result = await postgresPool.query(
          `
          SELECT a.id, s.name AS student_name, a.status, a.remarks
          FROM attendance a
          JOIN students s ON a.student_id = s.id
          WHERE a.class_id = $1 AND a.date = $2
          `,
          [classId, date]
      );
      res.json(result.rows);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});


// atendance record for specific student
app.get('/attendance/student/:studentId', async (req, res) => {
  const { studentId } = req.params;
  try {
      const result = await postgresPool.query(
          `
          SELECT date, status, remarks
          FROM attendance
          WHERE student_id = $1
          ORDER BY date DESC
          `,
          [studentId]
      );
      res.json(result.rows);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});


// update attendance for student
app.put('/attendance/:id', async (req, res) => {
  const { id } = req.params; // Attendance record ID
  const { status, remarks } = req.body;
  try {
      const result = await postgresPool.query(
          `
          UPDATE attendance
          SET status = $1, remarks = $2
          WHERE id = $3
          RETURNING *
          `,
          [status, remarks || null, id]
      );
      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Attendance record not found' });
      }
      res.json(result.rows[0]);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// delete end point for attendace
app.delete('/attendance/:id', async (req, res) => {
  const { id } = req.params;
  try {
      const result = await postgresPool.query(
          `DELETE FROM attendance WHERE id = $1 RETURNING *`,
          [id]
      );
      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Attendance record not found' });
      }
      res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete attendance record' });
  }
});

