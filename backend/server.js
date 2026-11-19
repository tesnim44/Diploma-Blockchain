
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/database");
const diplomaRoutes = require("./routes/diplomaRoutes");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/diplomas", diplomaRoutes);

// Home route
app.get("/", (req, res) => {
    res.send("Diploma Blockchain Backend is running!");
});

// Start server only after MongoDB connects
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
