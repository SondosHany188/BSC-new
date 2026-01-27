const pkg = require('pg');
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    password: 'sondos',
    port: 5432,
});

async function updateSchema() {
    const client = await pool.connect();
    try {
        console.log('Connecting to database...');

        console.log('Applying: ALTER TABLE kpis ADD COLUMN IF NOT EXISTS last_updated...');
        await client.query('ALTER TABLE kpis ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()');

        console.log('Applying: CREATE TABLE notifications...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
                message TEXT,
                type TEXT,
                status TEXT DEFAULT 'pending',
                count INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('Updating existing KPIs...');
        await client.query('UPDATE kpis SET last_updated = NOW() WHERE last_updated IS NULL');

        console.log('Schema update completed successfully!');
    } catch (err) {
        console.error('Error updating schema:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

updateSchema();
