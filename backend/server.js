const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");
const jwt = require("jsonwebtoken"); // JWT signing and verification for teacher auth
const bcrypt = require("bcryptjs");  // Password hashing (pure-JS, no native addons needed)

const app = express();
app.use(cors());
app.use(express.json());

const REGION = process.env.AWS_REGION || "us-east-1"; // AWS region for SSM client (default: us-east-1)
const ssm = new SSMClient({ region: REGION }); // Create SSM client using the configured region

let db;          // Module-level pool — set in the startup IIFE before routes are served
let JWT_SECRET;  // JWT signing secret loaded from SSM at startup — never hardcoded

/* ------------------ FETCH DB CONFIG FROM SSM ------------------ */

async function getDBConfig() {
  // Fetch all required parameters in a single SSM API call for efficiency
  const command = new GetParametersCommand({
    Names: [
      "/myapp/db/host",          // Database hostname
      "/myapp/db/user",          // Database username
      "/myapp/db/password",      // Database password (SecureString)
      "/myapp/db/name",          // Database name
      "/myapp/auth/jwt_secret"   // JWT signing secret (SecureString) for teacher authentication
    ],
    WithDecryption: true // Decrypt SecureString parameters so we receive plaintext values
  });

  const res = await ssm.send(command); // Send the command to SSM and await the response
  const params = {};

  // Map each parameter to a key using the last path segment (e.g., "/myapp/db/host" → "host")
  res.Parameters.forEach(p => {
    params[p.Name.split("/").pop()] = p.Value;
  });

  // Validate that all required parameters were returned — fail fast if any are missing
  if (!params.host || !params.user || !params.password || !params.name || !params.jwt_secret) {
    throw new Error("Missing required parameters in SSM");
  }

  return params; // Return the full params object including jwt_secret
}

/* ------------------ CREATE DATABASE IF NOT EXISTS ------------------ */

async function ensureDatabaseExists(config) {
  // Open a temporary connection without specifying a database so we can create it
  const conn = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.name}\``); // Create DB if absent
  await conn.end(); // Close the temporary connection immediately after use
  console.log("✅ Database verified");
}

/* ------------------ CONNECT TO DB ------------------ */

async function connectWithRetry(retries = 10, delay = 3000) {
  // Retry loop — waits for the database container to be ready before giving up
  for (let i = 1; i <= retries; i++) {
    try {
      const cfg = await getDBConfig(); // Fetch SSM credentials on each attempt

      await ensureDatabaseExists(cfg); // Ensure the database exists before creating a pool

      // Create a connection pool; ssl.rejectUnauthorized=false allows self-signed certs on RDS
      const pool = mysql.createPool({
        host: cfg.host,
        user: cfg.user,
        password: cfg.password,
        database: cfg.name,
        connectionLimit: 10,
        ssl: { rejectUnauthorized: false }
      });

      console.log("✅ Connected to RDS");
      return pool; // Return the ready pool to the caller
    } catch (err) {
      console.error(`❌ DB connection failed (attempt ${i})`, err.message);
      if (i === retries) throw err; // Rethrow on final attempt to propagate the failure
      await new Promise(r => setTimeout(r, delay)); // Wait before the next retry
    }
  }
}

/* ------------------ TABLE CREATION ------------------ */

async function ensureTables(db) {
  // Create the student table if it does not already exist (frozen schema — do not modify)
  await db.query(`
    CREATE TABLE IF NOT EXISTS student (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      roll_number VARCHAR(255),
      class VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create the teacher table if it does not already exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS teacher (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      subject VARCHAR(255),
      class VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create the teachers_auth table to store teacher login credentials
  await db.query(`
    CREATE TABLE IF NOT EXISTS teachers_auth (
      id            INT AUTO_INCREMENT PRIMARY KEY,    -- Surrogate primary key
      username      VARCHAR(255) NOT NULL UNIQUE,      -- Login identifier, must be unique per teacher
      password_hash VARCHAR(255) NOT NULL,             -- bcrypt hash — plaintext is never stored
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Audit timestamp
    )
  `);

  console.log("✅ Tables ready");
}

/* ------------------ AUTH MIDDLEWARE ------------------ */

// verifyToken — Express middleware that validates the JWT on protected teacher routes
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"]; // Read the Authorization header from the request
  if (!authHeader) {                               // Reject immediately if the header is absent
    return res.status(401).json({ error: "No token provided" }); // 401 Unauthorized
  }
  const token = authHeader.split(" ")[1]; // Extract the token from the "Bearer <token>" format
  if (!token) {                            // Reject if the header was present but malformed
    return res.status(401).json({ error: "Malformed authorization header" }); // 401 Unauthorized
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Verify signature and expiry using the secret
    req.teacher = decoded;                          // Attach the decoded payload for use in route handlers
    next();                                         // Token is valid — pass control to the route handler
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" }); // 403 Forbidden
  }
}

/* ------------------ ROUTES ------------------ */

// Health check — returns all students to confirm the backend and DB are reachable
app.get("/", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM student"); // Fetch all student rows for health check
  res.json({ message: "Backend running 🚀", data: rows }); // Return status message and data
});

// Frozen — do not modify this route
app.get("/student", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM student"); // Fetch all student records
  res.json(rows); // Return as JSON array
});

// Frozen — do not modify this route
app.post("/addstudent", async (req, res) => {
  const { name, rollNo, class: cls } = req.body; // Destructure student fields from request body
  await db.query(
    "INSERT INTO student (name, roll_number, class) VALUES (?, ?, ?)",
    [name, rollNo, cls] // Parameterized query prevents SQL injection
  );
  res.json({ message: "Student added" }); // Confirm insertion
});

// Frozen — do not modify this route
app.delete("/student/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the student ID from the URL parameter

    const [result] = await db.query(
      "DELETE FROM student WHERE id = ?",
      [id] // Parameterized query prevents SQL injection
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Student not found" }); // 404 if no row was deleted
    }

    res.json({ message: "Student deleted successfully" }); // Confirm deletion
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: "Failed to delete student" }); // 500 on unexpected DB error
  }
});

/* ------------------ TEACHER AUTH ROUTES ------------------ */

// POST /teacher/register — creates a new teacher login credential
// NOTE: This route is intentionally open for dev/admin bootstrapping.
// In production, add an admin secret guard before public deployment.
app.post("/teacher/register", async (req, res) => {
  try {
    const { username, password } = req.body; // Destructure credentials from request body
    if (!username || !password) {            // Validate both fields are present before proceeding
      return res.status(400).json({ error: "Username and password are required" }); // 400 Bad Request
    }
    const saltRounds = 10;                   // bcrypt work factor — 10 is the recommended default
    const hash = await bcrypt.hash(password, saltRounds); // Hash the password; never store plaintext
    await db.query(                          // Insert the new credential row into teachers_auth
      "INSERT INTO teachers_auth (username, password_hash) VALUES (?, ?)",
      [username, hash] // Parameterized query prevents SQL injection
    );
    res.status(201).json({ message: "Teacher registered successfully" }); // 201 Created
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {       // MySQL error code for UNIQUE constraint violation
      return res.status(409).json({ error: "Username already exists" }); // 409 Conflict
    }
    console.error("❌ Register error:", err); // Log unexpected errors for debugging
    res.status(500).json({ error: "Registration failed" }); // 500 Internal Server Error
  }
});

// POST /teacher/login — validates credentials and returns a signed JWT
app.post("/teacher/login", async (req, res) => {
  try {
    const { username, password } = req.body; // Destructure credentials from request body
    if (!username || !password) {            // Validate both fields are present before querying
      return res.status(400).json({ error: "Username and password are required" }); // 400 Bad Request
    }
    const [rows] = await db.query(           // Look up the teacher record by username
      "SELECT * FROM teachers_auth WHERE username = ?",
      [username] // Parameterized query prevents SQL injection
    );
    if (rows.length === 0) {                 // No matching record found in the database
      return res.status(401).json({ error: "Invalid credentials" }); // 401 — do not reveal which field failed
    }
    const teacher = rows[0];                 // Take the single matching row
    const match = await bcrypt.compare(password, teacher.password_hash); // Compare plaintext to stored hash
    if (!match) {                            // bcrypt comparison returned false — wrong password
      return res.status(401).json({ error: "Invalid credentials" }); // 401 — same message for security
    }
    const payload = { id: teacher.id, username: teacher.username }; // Minimal payload — no sensitive data
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" }); // Sign token valid for 8 hours
    res.json({ token }); // Return the signed JWT to the client
  } catch (err) {
    console.error("❌ Login error:", err);    // Log unexpected errors for debugging
    res.status(500).json({ error: "Login failed" }); // 500 Internal Server Error
  }
});

/* ------------------ TEACHER ROUTES (protected) ------------------ */

// GET /teacher — returns all teacher records; requires a valid JWT
app.get("/teacher", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM teacher"); // Fetch all teacher records
    res.json(rows); // Return as JSON array to the authenticated client
  } catch (err) {
    console.error("❌ Get teachers error:", err); // Log DB errors for debugging
    res.status(500).json({ error: "Failed to fetch teachers" }); // 500 on DB failure
  }
});

// POST /addteacher — inserts a new teacher record; requires a valid JWT
app.post("/addteacher", verifyToken, async (req, res) => {
  try {
    const { name, subject, class: cls } = req.body; // Destructure teacher fields from request body
    await db.query(
      "INSERT INTO teacher (name, subject, class) VALUES (?, ?, ?)",
      [name, subject, cls] // Parameterized query prevents SQL injection
    );
    res.json({ message: "Teacher added" }); // Confirm insertion
  } catch (err) {
    console.error("❌ Add teacher error:", err); // Log DB errors for debugging
    res.status(500).json({ error: "Failed to add teacher" }); // 500 on DB failure
  }
});

// DELETE /teacher/:id — deletes a teacher by ID; requires a valid JWT
app.delete("/teacher/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params; // Extract the teacher ID from the URL parameter

    const [result] = await db.query(
      "DELETE FROM teacher WHERE id = ?",
      [id] // Parameterized query prevents SQL injection
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Teacher not found" }); // 404 if no row was deleted
    }

    res.json({ message: "Teacher deleted successfully" }); // Confirm deletion
  } catch (err) {
    console.error("Delete teacher error:", err);
    res.status(500).json({ error: "Failed to delete teacher" }); // 500 on unexpected DB error
  }
});

/* ------------------ START SERVER ------------------ */

(async () => {
  try {
    const cfg = await getDBConfig();  // Fetch SSM params once at startup to obtain the JWT secret
    JWT_SECRET = cfg.jwt_secret;      // Assign the JWT signing secret to the module-level variable
    if (!JWT_SECRET) {                // Guard: crash loudly if the secret is somehow empty after SSM fetch
      throw new Error("JWT_SECRET is not set — check SSM parameter /myapp/auth/jwt_secret");
    }
    console.log("✅ JWT secret loaded"); // Confirm the secret was successfully retrieved

    db = await connectWithRetry();    // Connect to DB with retry (internally calls getDBConfig again — acceptable)
    await ensureTables(db);           // Create tables if they do not already exist

    const PORT = 3500;                // Server port — hardcoded per project convention
    app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`) // Confirm the server is accepting connections
    );
  } catch (err) {
    console.error("❌ App failed to start:", err); // Log the root cause of startup failure
    process.exit(1); // Exit with non-zero code so Docker/orchestrators know the container failed
  }
})();
