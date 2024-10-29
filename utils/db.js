import  Pool  from "pg-pool";  
import dotenv from "dotenv";

dotenv.config();

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

export { postgresPool, connectToDatabase };
