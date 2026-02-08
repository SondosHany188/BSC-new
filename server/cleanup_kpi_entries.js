import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    password: 'sondos',
    port: 5432,
});

async function cleanupKpiEntries() {
    const client = await pool.connect();
    try {
        console.log('Starting KPI entries cleanup...');

        const notifications = await client.query(`
            SELECT n.id, n.kpi_id, n.created_at, k.name as kpi_name, k.period
            FROM notifications n
            JOIN kpis k ON n.kpi_id = k.id
            WHERE n.status = 'pending'
            ORDER BY n.kpi_id
        `);

        console.log(`Found ${notifications.rows.length} pending notifications`);

        let totalDeleted = 0;

        for (const notif of notifications.rows) {
            const createdDate = new Date(notif.created_at);
            const createdDateStr = createdDate.toISOString().split('T')[0];

            console.log(`\nProcessing KPI: ${notif.kpi_name} (ID: ${notif.kpi_id})`);
            console.log(`  Notification created: ${createdDateStr}`);

            const deleteResult = await client.query(`
                DELETE FROM kpi_entries 
                WHERE kpi_id = $1 
                AND date_recorded >= $2
                RETURNING id, date_recorded, value
            `, [notif.kpi_id, createdDateStr]);

            if (deleteResult.rows.length > 0) {
                console.log(`  Deleted ${deleteResult.rows.length} entries:`);
                deleteResult.rows.forEach(row => {
                    console.log(`    - Date: ${row.date_recorded.toISOString().split('T')[0]}, Value: ${row.value}`);
                });
                totalDeleted += deleteResult.rows.length;
            } else {
                console.log(`  No entries to delete`);
            }
        }

        console.log(`\n✅ Cleanup complete! Total entries deleted: ${totalDeleted}`);

    } catch (err) {
        console.error('❌ Error during cleanup:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupKpiEntries()
    .then(() => {
        console.log('\n🎉 Script completed successfully');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n💥 Script failed:', err);
        process.exit(1);
    });
