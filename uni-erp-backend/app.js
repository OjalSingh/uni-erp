require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const { UPLOAD_DIR } = require("./src/routes/uploads");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/", (_req, res) => res.send("Backend running"));
app.get("/api/test", (_req, res) => res.json({ message: "Hello from backend" }));
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/dashboard", require("./src/routes/dashboard"));
app.use("/api/centers", require("./src/routes/centers"));
app.use("/api/students", require("./src/routes/students"));
app.use("/api/masters", require("./src/routes/masters"));
app.use("/api/uploads", require("./src/routes/uploads"));
app.use("/uploads", express.static(UPLOAD_DIR));

// Express 5 forwards async errors here
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
