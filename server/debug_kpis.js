
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    password: 'admin',
    port: 5432,
});

async function checkKpis() {
    try {
        console.log("Connecting...");
        const client = await pool.connect();
        console.log("Connected. Querying...");
        const res = await client.query("SELECT id, name, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at FROM kpis ORDER BY created_at ASC LIMIT 10");
        console.log("--- OLDEST 10 KPIS ---");
        console.table(res.rows);

        const history = await client.query("SELECT kpi_id, MIN(date_recorded) as first_entry FROM kpi_entries GROUP BY kpi_id LIMIT 10");
        console.log("--- HISTORY MIN DATES ---");
        console.table(history.rows);

        client.release();
    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        pool.end();
    }
}

checkKpis();
