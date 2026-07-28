const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/src/img'));
    },
    filename: function (req, file, cb) {
        // Keep original name but add timestamp to avoid overwrites
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Security Middleware (Simple Password Check)
const adminPassword = 'vertigoadmin'; // Change this in production
function checkAuth(req, res, next) {
    const pwd = req.headers['x-admin-password'] || req.body.password;
    if (pwd === adminPassword) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Invalid password.' });
    }
}

// GET Data
app.get('/api/data', (req, res) => {
    res.set('Cache-Control', 'no-store');
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read data' });
        res.json(JSON.parse(data));
    });
});

// Verify Password
app.post('/api/verify', checkAuth, (req, res) => {
    res.json({ success: true });
});

// POST Update Data
app.post('/api/data', checkAuth, (req, res) => {
    // Remove the password field before saving
    const dataToSave = { ...req.body };
    delete dataToSave.password;

    fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save data' });
        res.json({ message: 'Data updated successfully' });
    });
});

// POST Upload Image
app.post('/api/upload', checkAuth, upload.single('cover'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the relative path to the image
    const relativePath = 'src/img/' + req.file.filename;
    res.json({ path: relativePath });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
