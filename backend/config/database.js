
const mongoose = require("mongoose");

const connectDB = async () => {
    await mongoose.connect("mongodb://127.0.0.1:27017/DiplomaDB");

    console.log("MongoDB connected successfully!");
};

module.exports = connectDB;
