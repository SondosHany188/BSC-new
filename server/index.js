import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

// Verbose logging for debugging
console.log('--- Server Starting ---');
console.log('Node Version:', process.version);
console.log('Database Settings:', {
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    port: 5432,
});

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bsc_db',
    password: 'sondos',
    port: 5432,
});

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('CRITICAL ERROR (Uncaught Exception):', err.message);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
    process.exit(1);
});

// --- Database Migration Logic ---

async function ensureSchema() {
    const client = await pool.connect();
    try {
        console.log('Checking database schema...');

        // Add last_updated to kpis
        await client.query(`
            ALTER TABLE kpis 
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()
        `);

        // Create notifications table
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

        // Add critical_limit to kpis
        await client.query(`
            ALTER TABLE kpis 
            ADD COLUMN IF NOT EXISTS critical_limit DECIMAL(15,2) DEFAULT 0
        `);

        // Ensure existing KPIs have a timestamp
        await client.query('UPDATE kpis SET last_updated = NOW() WHERE last_updated IS NULL');

        console.log('Database schema verified successfully.');
    } catch (err) {
        console.error('DATABASE SCHEMA ERROR:', err.message);
        // We don't exit here, but the server might fail later if tables are missing
    } finally {
        client.release();
    }
}

// Test DB Connection early
console.log('Attempting to connect to database...');
pool.query('SELECT NOW()')
    .then(async res => {
        console.log('SUCCESS: Connected to Database at:', res.rows[0].now);
        await ensureSchema();
    })
    .catch(err => {
        console.error('DATABASE CONNECTION ERROR:', err.message);
        console.error('Check if PostgreSQL is running and "bsc_db" exists with password "sondos".');
    });

// --- API Endpoints ---

// Get all departments with hierarchy
app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        d.id as dept_id, d.name as dept_name, d.icon_name,
        p.id as perspective_id, p.name as perspective_name,
        g.id as goal_id, g.name as goal_name, g.weight as goal_weight
      FROM departments d
      LEFT JOIN perspectives p ON d.id = p.department_id
      LEFT JOIN goals g ON p.id = g.perspective_id
      ORDER BY d.id, p.id, g.id
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('API Error (/api/departments):', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Add Department
app.post('/api/departments', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO departments (name) VALUES ($1) RETURNING *',
            [name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('API Error (/api/departments POST):', err.message);
        res.status(500).json({ error: 'Could not create department' });
    }
});

// --- Notifications Logic ---

async function refreshNotifications() {
    const client = await pool.connect();
    try {
        // Find daily KPIs not updated today
        const dailyKpis = await client.query(`
            SELECT id, name FROM kpis 
            WHERE period = 'daily' 
            AND (last_updated IS NULL OR last_updated < CURRENT_DATE)
        `);

        for (const kpi of dailyKpis.rows) {
            const existing = await client.query(
                "SELECT id, count, created_at FROM notifications WHERE kpi_id = $1 AND status = 'pending'",
                [kpi.id]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    "INSERT INTO notifications (kpi_id, message, type) VALUES ($1, $2, 'kpi_entry')",
                    [kpi.id, `يرجى إضافة قيمة مؤشر ${kpi.name}`]
                );
            } else {
                const lastCreation = new Date(existing.rows[0].created_at);
                const today = new Date();
                if (lastCreation.toDateString() !== today.toDateString()) {
                    await client.query(
                        "UPDATE notifications SET count = count + 1, created_at = NOW() WHERE id = $1",
                        [existing.rows[0].id]
                    );
                }
            }
        }
    } catch (err) {
        console.error('Error refreshing notifications:', err.message);
    } finally {
        client.release();
    }
}

// Add KPI and potentially Goal
app.post('/api/indicators', async (req, res) => {
    const {
        departmentId, perspectiveName, goalName, goalWeight, indicatorName,
        description, target, actual, criticalLimit, unit, period, weight, direction
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Ensure Perspective exists for this Dept
        let pRes = await client.query(
            'SELECT id FROM perspectives WHERE name = $1 AND department_id = $2',
            [perspectiveName, departmentId]
        );
        let perspectiveId;
        if (pRes.rows.length === 0) {
            pRes = await client.query(
                'INSERT INTO perspectives (name, department_id) VALUES ($1, $2) RETURNING id',
                [perspectiveName, departmentId]
            );
            perspectiveId = pRes.rows[0].id;
        } else {
            perspectiveId = pRes.rows[0].id;
        }

        // 2. Ensure Goal exists and has the correct weight
        let gRes = await client.query(
            'SELECT id FROM goals WHERE name = $1 AND perspective_id = $2',
            [goalName, perspectiveId]
        );
        let goalId;
        if (gRes.rows.length === 0) {
            gRes = await client.query(
                'INSERT INTO goals (name, perspective_id, weight) VALUES ($1, $2, $3) RETURNING id',
                [goalName, perspectiveId, goalWeight]
            );
            goalId = gRes.rows[0].id;
        } else {
            goalId = gRes.rows[0].id;
            // Update weight if goal already exists
            await client.query(
                'UPDATE goals SET weight = $1 WHERE id = $2',
                [goalWeight, goalId]
            );
        }

        // 3. Insert KPI
        const kpiRes = await client.query(
            `INSERT INTO kpis (name, description, goal_id, target_value, actual_value, critical_limit, unit, period, weight, direction) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [indicatorName, description, goalId, target, actual, criticalLimit, unit, period, weight, direction]
        );

        await client.query('COMMIT');
        res.status(201).json(kpiRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('API Error (/api/indicators POST):', err.message);
        res.status(500).json({ error: 'Transaction failed' });
    } finally {
        client.release();
    }
});

// Notifications API
app.get('/api/notifications', async (req, res) => {
    try {
        await refreshNotifications();
        const result = await pool.query(`
            SELECT n.*, k.name as kpi_name, k.description as kpi_description,
                p.name as perspective_name,
                d.name as department_name,
                k.target_value,
                k.critical_limit,
                k.direction
            FROM notifications n
            JOIN kpis k ON n.kpi_id = k.id
            JOIN goals g ON k.goal_id = g.id
            JOIN perspectives p ON g.perspective_id = p.id
            JOIN departments d ON p.department_id = d.id
            WHERE n.status = 'pending'
            ORDER BY n.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('API Error (/api/notifications):', err.message);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Update KPI value and resolve notification
app.post('/api/kpis/:id/actual', async (req, res) => {
    const { id } = req.params;
    const { actual } = req.body;
    try {
        await pool.query(
            "UPDATE kpis SET actual_value = $1, last_updated = NOW() WHERE id = $2",
            [actual, id]
        );
        await pool.query(
            "UPDATE notifications SET status = 'resolved' WHERE kpi_id = $1",
            [id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('API Error (/api/kpis/:id/actual):', err.message);
        res.status(500).json({ error: 'Failed to update KPI' });
    }
});

// Get goals by department and perspective
app.get('/api/goals', async (req, res) => {
    const { departmentId, perspectiveName } = req.query;
    try {
        const result = await pool.query(`
            SELECT g.id, g.name, g.weight 
            FROM goals g
            JOIN perspectives p ON g.perspective_id = p.id
            WHERE p.department_id = $1 AND p.name = $2
        `, [departmentId, perspectiveName]);
        res.json(result.rows);
    } catch (err) {
        console.error('API Error (/api/goals):', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Reports API with multi-step calculations
app.get('/api/reports', async (req, res) => {
    try {
        const kpisResult = await pool.query(`
            SELECT 
                d.name as department,
                p.id as perspective_id,
                p.name as perspective,
                g.id as goal_id,
                g.name as goal_name,
                g.weight as goal_rate,
                k.id as kpi_id,
                k.name as indicator,
                k.target_value as target,
                k.actual_value as actual,
                k.critical_limit,
                k.weight as kpi_weight,
                k.direction,
                k.period
            FROM kpis k
            JOIN goals g ON k.goal_id = g.id
            JOIN perspectives p ON g.perspective_id = p.id
            JOIN departments d ON p.department_id = d.id
        `);

        const rows = kpisResult.rows;
        if (rows.length === 0) return res.json([]);

        // Calculate individual KPI status and achievement
        const processedKpis = rows.map(row => {
            let status = 'red';
            let achievement = 0;

            const actual = Number(row.actual) || 0;
            const target = Number(row.target) || 0;
            const critical = Number(row.critical_limit) || 0;

            if (row.direction === 'up') {
                // Maximize logic
                if (actual >= target) {
                    status = 'green';
                } else if (actual >= critical) {
                    status = 'yellow';
                } else {
                    status = 'red';
                }
                achievement = target > 0 ? (actual / target) * 100 : 0;
            } else {
                // Minimize logic
                if (actual <= target) {
                    status = 'green';
                } else if (actual <= critical) {
                    status = 'yellow';
                } else {
                    status = 'red';
                }
                achievement = actual > 0 ? (target / actual) * 100 : 100;
            }

            return {
                ...row,
                status,
                achievement: Math.min(Math.max(achievement, 0), 100) // Cap for calc purposes
            };
        });

        const goalData = {};
        processedKpis.forEach(row => {
            if (!goalData[row.goal_id]) {
                goalData[row.goal_id] = {
                    achievements: [],
                    weight: row.goal_rate || 0,
                    perspective_id: row.perspective_id
                };
            }
            goalData[row.goal_id].achievements.push(row.achievement);
        });

        const perspectiveAcc = {};
        Object.keys(goalData).forEach(gid => {
            const gd = goalData[gid];
            const avg = gd.achievements.reduce((a, b) => a + b, 0) / gd.achievements.length;
            const pid = gd.perspective_id;

            if (!perspectiveAcc[pid]) {
                perspectiveAcc[pid] = 0;
            }
            perspectiveAcc[pid] += (avg * (gd.weight / 100));
        });

        const finalData = processedKpis.map(row => {
            const avg = goalData[row.goal_id].achievements.reduce((a, b) => a + b, 0) / goalData[row.goal_id].achievements.length;
            return {
                ...row,
                goal_completion: avg,
                perspective_completion: perspectiveAcc[row.perspective_id]
            };
        });

        res.json(finalData);
    } catch (err) {
        console.error('API Error (/api/reports):', err.message);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

// Delete Indicator
app.delete('/api/indicators/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM kpis WHERE id = $1', [id]);
        res.json({ message: 'Indicator deleted' });
    } catch (err) {
        console.error('API Error (/api/indicators DELETE):', err.message);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

console.log('Starting Express server on port:', port);
app.listen(port, () => {
    console.log(`READY: Server running at http://localhost:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`ERROR: Port ${port} is already in use by another program.`);
    } else {
        console.error('ERROR starting Express server:', err.message);
    }
    process.exit(1);
});
