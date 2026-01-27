import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    password: 'sondos',
    port: 5432,
});

async function verify() {
    const client = await pool.connect();
    try {
        const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='kpis' AND column_name='last_updated'");
        const tabRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name='notifications'");

        console.log('--- VERIFICATION RESULTS ---');
        console.log('last_updated column exists:', colRes.rows.length > 0 ? 'YES' : 'NO');
        console.log('notifications table exists:', tabRes.rows.length > 0 ? 'YES' : 'NO');

        if (colRes.rows.length > 0 && tabRes.rows.length > 0) {
            console.log('SUCCESS: Schema is correct.');
        } else {
            console.log('FAILURE: Schema mismatch.');
        }
    } catch (err) {
        console.error('Verification error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
