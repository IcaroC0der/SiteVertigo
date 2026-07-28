require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to Postgres');

        // Create tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS site_info (
                id SERIAL PRIMARY KEY,
                about TEXT,
                video VARCHAR(255),
                contact_presave TEXT,
                contact_youtube TEXT,
                contact_whatsapp TEXT,
                contact_email TEXT
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS shows (
                id SERIAL PRIMARY KEY,
                date TEXT,
                link TEXT
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS albums (
                id SERIAL PRIMARY KEY,
                title TEXT,
                type TEXT,
                cover TEXT,
                link TEXT
            );
        `);

        console.log('Tables created.');

        // Clear existing data (if any)
        await client.query('TRUNCATE TABLE site_info, shows, albums RESTART IDENTITY;');

        // Read data.json
        const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

        // Insert site_info
        await client.query(`
            INSERT INTO site_info (id, about, video, contact_presave, contact_youtube, contact_whatsapp, contact_email)
            VALUES (1, $1, $2, $3, $4, $5, $6)
        `, [
            data.about,
            data.video,
            data.contact?.presave || '',
            data.contact?.youtube || '',
            data.contact?.whatsapp || '',
            data.contact?.email || ''
        ]);

        // Insert shows
        for (const show of (data.shows || [])) {
            await client.query(`
                INSERT INTO shows (date, link) VALUES ($1, $2)
            `, [show.date, show.link]);
        }

        // Insert albums
        for (const album of (data.albums || [])) {
            await client.query(`
                INSERT INTO albums (title, type, cover, link) VALUES ($1, $2, $3, $4)
            `, [album.title, album.type, album.cover, album.link]);
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
