require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { put } = require('@vercel/blob');

async function uploadExistingImages() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
        await client.connect();
        const res = await client.query('SELECT * FROM albums');

        for (let album of res.rows) {
            if (album.cover.startsWith('src/img/')) {
                const localPath = path.join(__dirname, 'public', album.cover);
                
                if (fs.existsSync(localPath)) {
                    console.log(`Uploading ${album.title}...`);
                    const fileBuffer = fs.readFileSync(localPath);
                    const fileName = path.basename(localPath);
                    
                    const blob = await put(`covers/${fileName}`, fileBuffer, {
                        access: 'public',
                        token: process.env.BLOB_READ_WRITE_TOKEN
                    });
                    
                    console.log(`Uploaded! New URL: ${blob.url}`);
                    
                    await client.query('UPDATE albums SET cover = $1 WHERE id = $2', [blob.url, album.id]);
                    console.log(`Database updated for album ${album.title}`);
                } else {
                    console.log(`File not found: ${localPath}`);
                }
            }
        }
        console.log('All existing images migrated to Vercel Blob!');
    } catch (err) {
        console.error('Error during migration:', err);
    } finally {
        await client.end();
    }
}

uploadExistingImages();
