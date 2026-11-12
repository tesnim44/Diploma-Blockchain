
const API_URL = "http://localhost:3000/api/diplomas";

const diplomaForm = document.getElementById("diplomaForm");
const statusMessage = document.getElementById("status");
const issueButton = document.getElementById("issueButton");

// Calculate the SHA-256 hash of the selected PDF
async function calculateSHA256(file) {
    const buffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        buffer
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

// Handle form submission
diplomaForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        issueButton.disabled = true;
        statusMessage.textContent = "Preparing diploma...";

        // Get form values
        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const field = document.getElementById("field").value.trim();
        const year = Number(document.getElementById("year").value);
        const file = document.getElementById("diplomaFile").files[0];

        // Validate PDF
        if (!file || file.type !== "application/pdf") {
            throw new Error("Please select a valid PDF file.");
        }

        // Calculate real PDF hash
        statusMessage.textContent = "Calculating PDF hash...";

        const pdfHash = await calculateSHA256(file);

        // Generate a unique diploma ID
        const diplomaId = "DIP-" + crypto.randomUUID();

        // Prepare data for MongoDB
        const diplomaData = {
            diplomaId,
            firstName,
            lastName,
            field,
            year,
            pdfHash
        };

        // Send data to backend
        statusMessage.textContent = "Saving diploma information...";

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(diplomaData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save diploma.");
        }

        statusMessage.textContent =
            "Diploma saved successfully! ID: " + diplomaId;

        console.log("Saved diploma:", result.diploma);
        console.log("PDF SHA-256:", pdfHash);

        diplomaForm.reset();

    } catch (error) {
        console.error(error);

        statusMessage.textContent = "Error: " + error.message;

    } finally {
        issueButton.disabled = false;
    }
});

// Load all diplomas from the backend
async function loadDiplomas() {
    const tableBody = document.getElementById("diplomasTableBody");
    const dashboardStatus = document.getElementById("dashboardStatus");

    dashboardStatus.textContent = "Loading diplomas...";
    tableBody.replaceChildren();

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Unable to retrieve diplomas.");
        }

        const diplomas = await response.json();

        if (diplomas.length === 0) {
            dashboardStatus.textContent = "No diplomas registered yet.";
            return;
        }

        diplomas.forEach((diploma) => {
            const row = document.createElement("tr");

            const values = [
                diploma.diplomaId,
                `${diploma.firstName} ${diploma.lastName}`,
                diploma.field,
                diploma.year,
                diploma.pdfHash
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        dashboardStatus.textContent =
            `${diplomas.length} diploma(s) registered.`;

    } catch (error) {
        dashboardStatus.textContent = error.message;
        console.error(error);
    }
}

// Refresh button
document.getElementById("refreshDiplomas")
    .addEventListener("click", loadDiplomas);

// Load diplomas when the page opens
loadDiplomas();


