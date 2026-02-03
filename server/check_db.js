import pkg from 'pg';
import fs from 'fs';
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres', host: 'localhost', database: 'bsc_db', password: 'sondos', port: 5432,
});

async function findConstraints() {
    let output = '';
    try {
        const res = await pool.query(`
            SELECT 
                tc.relname as table_name,
                c.conname as constraint_name,
                pg_get_constraintdef(c.oid) as definition
            FROM pg_constraint c
            JOIN pg_class tc ON c.conrelid = tc.oid
            JOIN pg_class fc ON c.confrelid = fc.oid
            WHERE fc.relname = 'kpis';
        `);
        output = JSON.stringify(res.rows, null, 2);
    } catch (err) {
        output = 'ERROR: ' + err.stack;
    } finally {
        fs.writeFileSync('d:/BSC v3/interface-enhancer-main/server/db_results.txt', output);
        await pool.end();
    }
}

findConstraints();
