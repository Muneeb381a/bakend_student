import { postgresPool } from "../utils/db.js";


export default async function handler(req, res) {
  if (req.method === 'GET') {
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
  } else {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
