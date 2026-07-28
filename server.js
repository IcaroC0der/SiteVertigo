require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const { put } = require('@vercel/blob');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const adminPassword = 'vertigoadmin'; // Change this in production

function checkAuth(req, res, next) {
    const pwd = req.headers['x-admin-password'] || req.body.password;
    if (pwd === adminPassword) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Invalid password.' });
    }
}

// Multer using memory storage so we can upload the buffer to Vercel Blob
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to get DB client
const getClient = () => new Client({ connectionString: process.env.DATABASE_URL });

// GET Data
app.get('/api/data', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const client = getClient();
    try {
        await client.connect();
        
        const siteInfoRes = await client.query('SELECT * FROM site_info WHERE id = 1');
        const showsRes = await client.query('SELECT * FROM shows ORDER BY id ASC');
        const albumsRes = await client.query('SELECT * FROM albums ORDER BY id ASC');

        const info = siteInfoRes.rows[0] || {};
        
        const data = {
            about: info.about || '',
            video: info.video || '',
            contact: {
                presave: info.contact_presave || '',
                youtube: info.contact_youtube || '',
                whatsapp: info.contact_whatsapp || '',
                email: info.contact_email || ''
            },
            shows: showsRes.rows,
            albums: albumsRes.rows
        };

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        await client.end();
    }
});

// Verify Password
app.post('/api/verify', checkAuth, (req, res) => {
    res.json({ success: true });
});

// POST Update Data
app.post('/api/data', checkAuth, async (req, res) => {
    const data = req.body;
    const client = getClient();

    try {
        await client.connect();
        await client.query('BEGIN'); // Start transaction

        // Update site_info
        await client.query(`
            UPDATE site_info 
            SET about = $1, video = $2, contact_presave = $3, contact_youtube = $4, contact_whatsapp = $5, contact_email = $6
            WHERE id = 1
        `, [
            data.about, data.video, data.contact.presave, data.contact.youtube, data.contact.whatsapp, data.contact.email
        ]);

        // Rebuild shows
        await client.query('TRUNCATE TABLE shows RESTART IDENTITY');
        if (data.shows && data.shows.length > 0) {
            for (const show of data.shows) {
                await client.query('INSERT INTO shows (date, link) VALUES ($1, $2)', [show.date, show.link]);
            }
        }

        // Rebuild albums
        await client.query('TRUNCATE TABLE albums RESTART IDENTITY');
        if (data.albums && data.albums.length > 0) {
            for (const album of data.albums) {
                await client.query('INSERT INTO albums (title, type, cover, link) VALUES ($1, $2, $3, $4)', 
                [album.title, album.type, album.cover, album.link]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Data updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to update data' });
    } finally {
        await client.end();
    }
});

// POST Upload Image to Vercel Blob
app.post('/api/upload', checkAuth, upload.single('cover'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
             throw new Error("BLOB_READ_WRITE_TOKEN is missing in .env");
        }

        // Upload to Vercel Blob
        const blob = await put(`covers/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
            access: 'public',
        });

        // Vercel Blob returns the public URL in 'blob.url'
        res.json({ path: blob.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to upload to Cloud Storage: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
