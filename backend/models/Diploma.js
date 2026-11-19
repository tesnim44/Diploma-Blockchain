
const mongoose = require("mongoose");

const diplomaSchema = new mongoose.Schema(
    {
        diplomaId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        firstName: {
            type: String,
            required: true,
            trim: true
        },

        lastName: {
            type: String,
            required: true,
            trim: true
        },

        field: {
            type: String,
            required: true,
            trim: true
        },

        year: {
            type: Number,
            required: true
        },

        pdfHash: {
            type: String,
            required: true,
            match: /^[a-fA-F0-9]{64}$/
        },

    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Diploma", diplomaSchema);
