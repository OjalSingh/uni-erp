const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// ✅ NEW ROUTE
app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from backend 👋" });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});