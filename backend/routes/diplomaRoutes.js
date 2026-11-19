
const express = require("express");
const Diploma = require("../models/Diploma");

const router = express.Router();

// POST: Save a new diploma
router.post("/", async (req, res) => {
    try {
        const diploma = new Diploma(req.body);

        const savedDiploma = await diploma.save();

        res.status(201).json({
            message: "Diploma saved successfully!",
            diploma: savedDiploma
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "This diploma ID already exists."
            });
        }

        res.status(400).json({
            message: "Could not save diploma.",
            error: error.message
        });
    }
});

// GET: Retrieve all diplomas (admin prototype)
router.get("/", async (req, res) => {
    try {
        const diplomas = await Diploma.find().sort({ createdAt: -1 });

        res.status(200).json(diplomas);

    } catch (error) {
        res.status(500).json({
            message: "Could not retrieve diplomas.",
            error: error.message
        });
    }
});

module.exports = router;
