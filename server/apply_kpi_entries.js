const pkg = require('pg');
const { Pool } = pkg;
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    password: 'sondos',
    port: 5432,
});

async function applyMigration() {
    const client = await pool.connect();
    try {
        console.log('Reading migration file...');
        const sql = fs.readFileSync(path.join(__dirname, 'migration_kpi_entries.sql'), 'utf8');

        console.log('Applying kpi_entries schema...');
        await client.query(sql);

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Error applying migration:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

applyMigration();
