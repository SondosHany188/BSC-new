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

        // Ensure ON DELETE CASCADE is active for existing notifications table
        try {
            await client.query(`
                ALTER TABLE notifications 
                DROP CONSTRAINT IF EXISTS notifications_kpi_id_fkey,
                ADD CONSTRAINT notifications_kpi_id_fkey 
                FOREIGN KEY (kpi_id) REFERENCES kpis(id) ON DELETE CASCADE
            `);
        } catch (err) {
            console.log('Note: Constraint update info:', err.message);
        }

        // Add critical_limit to kpis
        await client.query(`
            ALTER TABLE kpis 
            ADD COLUMN IF NOT EXISTS critical_limit DECIMAL(15,2) DEFAULT 0
        `);

        // Create kpi_entries table for history
        await client.query(`
            CREATE TABLE IF NOT EXISTS kpi_entries (
                id SERIAL PRIMARY KEY,
                kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
                value DECIMAL(15,2) NOT NULL,
                date_recorded DATE NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_id ON kpi_entries(kpi_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_kpi_entries_date ON kpi_entries(date_recorded)');

        // Ensure existing KPIs have a timestamp
        await client.query('UPDATE kpis SET last_updated = NOW() WHERE last_updated IS NULL');

        // Backfill kpi_entries for existing KPIs that have no history
        await client.query(`
            INSERT INTO kpi_entries (kpi_id, value, date_recorded, notes)
            SELECT id, actual_value, COALESCE(last_updated::date, CURRENT_DATE), 'Initial Sync'
            FROM kpis
            WHERE id NOT IN (SELECT DISTINCT kpi_id FROM kpi_entries)
        `);

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

        const newKpi = kpiRes.rows[0];

        // 4. Create Initial History Entry
        await client.query(
            'INSERT INTO kpi_entries (kpi_id, value, date_recorded, notes) VALUES ($1, $2, CURRENT_DATE, $3)',
            [newKpi.id, actual || 0, 'Initial Creation']
        );

        // 5. If daily, create a pending notification
        if (period === 'daily') {
            await client.query(
                "INSERT INTO notifications (kpi_id, message, type) VALUES ($1, $2, 'kpi_entry')",
                [newKpi.id, `يرجى إضافة قيمة مؤشر ${indicatorName}`]
            );
        }

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
                CASE 
                    WHEN k.period = 'daily' AND NOT EXISTS (
                        SELECT 1 FROM kpi_entries 
                        WHERE kpi_id = k.id 
                        AND date_recorded::date = CURRENT_DATE
                    )
                    THEN 0 
                    ELSE k.actual_value 
                END as actual,
                k.critical_limit,
                k.weight as kpi_weight,
                k.direction,
                k.period,
                k.description,
                k.unit
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
                // Formula 1: Maximize (Up Arrow)
                // Ai = (Current Value / Target) * 100
                achievement = target > 0 ? (actual / target) * 100 : 0;

                // Status mapping (Keep existing for visual cues)
                if (actual >= target) status = 'green';
                else if (actual >= critical) status = 'yellow';
                else status = 'red';
            } else {
                // Formula 2: Minimize (Down Arrow) - Universal Negative Polarity Formula
                // If Value <= Target: Achievement = 100%
                // If Value >= Failure Point (Critical): Achievement = 0%
                // In-between: Achievement = (1 - (Value - Target) / (Failure Point - Target)) * 100

                if (actual <= target) {
                    achievement = 100;
                    status = 'green';
                } else if (actual >= critical) {
                    achievement = 0;
                    status = 'red';
                } else {
                    const denominator = critical - target;
                    const deficitRatio = denominator > 0 ? (actual - target) / denominator : 1;
                    achievement = 100 * (1 - deficitRatio);
                    status = 'yellow';
                }
            }

            return {
                ...row,
                status,
                achievement: Math.max(achievement, 0) // Allow > 100 for "Up", but floor at 0
            };
        });

        // Formula 3: Goal Achievement (Oj)
        // Oj = sum(Ai * Wi) where Wi is decimal
        const goalData = {};
        processedKpis.forEach(row => {
            if (!goalData[row.goal_id]) {
                goalData[row.goal_id] = {
                    totalAchievement: 0,
                    weight: row.goal_rate || 0,
                    perspective_id: row.perspective_id
                };
            }
            // Add weighted KPI achievement (row.kpi_weight / 100 converts to decimal)
            goalData[row.goal_id].totalAchievement += (row.achievement * (Number(row.kpi_weight) / 100));
        });

        // Formula 4: Perspective Achievement (P)
        // P = sum(Oj * Wobj)
        const perspectiveAcc = {};
        Object.keys(goalData).forEach(gid => {
            const gd = goalData[gid];
            const pid = gd.perspective_id;
            if (!perspectiveAcc[pid]) perspectiveAcc[pid] = 0;

            // gd.totalAchievement is Oj
            // gd.weight is goal weight percent
            perspectiveAcc[pid] += (gd.totalAchievement * (gd.weight / 100));
        });

        const finalData = processedKpis.map(row => {
            return {
                ...row,
                goal_completion: goalData[row.goal_id].totalAchievement,
                perspective_completion: perspectiveAcc[row.perspective_id]
            };
        });

        res.json(finalData);

        /* 
        OLD CALCULATION LOGIC (RETAINED BUT UNUSED)
        const processedKpisOld = rows.map(row => {
            let status = 'red';
            let achievement = 0;
            const actual = Number(row.actual) || 0;
            const target = Number(row.target) || 0;
            const critical = Number(row.critical_limit) || 0;
            if (row.direction === 'up') {
                if (actual >= target) status = 'green';
                else if (actual >= critical) status = 'yellow';
                else status = 'red';
                achievement = target > 0 ? (actual / target) * 100 : 0;
            } else {
                if (actual <= target) status = 'green';
                else if (actual <= critical) status = 'yellow';
                else status = 'red';
                achievement = actual > 0 ? (target / actual) * 100 : 100;
            }
            return { ...row, status, achievement: Math.min(Math.max(achievement, 0), 100) };
        });
        const goalDataOld = {};
        processedKpisOld.forEach(row => {
            if (!goalDataOld[row.goal_id]) goalDataOld[row.goal_id] = { achievements: [], weight: row.goal_rate || 0, perspective_id: row.perspective_id };
            goalDataOld[row.goal_id].achievements.push(row.achievement);
        });
        const perspectiveAccOld = {};
        Object.keys(goalDataOld).forEach(gid => {
            const gd = goalDataOld[gid];
            const avg = gd.achievements.reduce((a, b) => a + b, 0) / gd.achievements.length;
            const pid = gd.perspective_id;
            if (!perspectiveAccOld[pid]) perspectiveAccOld[pid] = 0;
            perspectiveAccOld[pid] += (avg * (gd.weight / 100));
        });
        */
    } catch (err) {
        console.error('API Error (/api/reports):', err.message);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

// Update Indicator
app.put('/api/indicators/:id', async (req, res) => {
    const { id } = req.params;
    const {
        departmentId, perspectiveName, goalName, goalWeight, indicatorName,
        description, target, criticalLimit, unit, period, weight, direction
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Ensure Perspective exists
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

        // 2. Ensure Goal exists
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
            await client.query('UPDATE goals SET weight = $1 WHERE id = $2', [goalWeight, goalId]);
        }

        // 3. Update KPI
        await client.query(
            `UPDATE kpis SET 
                name = $1, description = $2, goal_id = $3, target_value = $4, 
                critical_limit = $5, unit = $6, period = $7, weight = $8, direction = $9,
                last_updated = NOW()
             WHERE id = $10`,
            [indicatorName, description, goalId, target, criticalLimit, unit, period, weight, direction, id]
        );

        // 4. If daily, ensure a notification exists
        if (period === 'daily') {
            const existing = await client.query(
                "SELECT id FROM notifications WHERE kpi_id = $1 AND status = 'pending'",
                [id]
            );
            if (existing.rows.length === 0) {
                await client.query(
                    "INSERT INTO notifications (kpi_id, message, type) VALUES ($1, $2, 'kpi_entry')",
                    [id, `يرجى إضافة قيمة مؤشر ${indicatorName}`]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Indicator updated' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('API Error (/api/indicators PUT):', err.message);
        res.status(500).json({ error: 'Update failed' });
    } finally {
        client.release();
    }
});

// Get Single KPI Details (including start date based on history)
app.get('/api/kpis/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT k.*, 
            (SELECT MIN(date_recorded) FROM kpi_entries WHERE kpi_id = k.id) as start_date
            FROM kpis k 
            WHERE k.id = $1
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'KPI not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('API Error (/api/kpis/:id GET):', err.message);
        res.status(500).json({ error: 'Failed to fetch KPI details' });
    } finally {
        client.release();
    }
});

// --- KPI History Endpoints ---

// Update KPI Actual Value (from Notifications/Evaluation)
app.post('/api/kpis/:id/actual', async (req, res) => {
    const { id } = req.params;
    const { actual } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Insert into history (Use current date)
        await client.query(
            'INSERT INTO kpi_entries (kpi_id, value, date_recorded, notes) VALUES ($1, $2, CURRENT_DATE, $3)',
            [id, actual, 'Notification Update']
        );

        // 2. Update Main KPI
        // We always assume this new "actual" is the latest relevant value for now
        await client.query(
            'UPDATE kpis SET actual_value = $1, last_updated = NOW() WHERE id = $2',
            [actual, id]
        );

        // 3. Mark notification as completed if exists
        await client.query(
            "UPDATE notifications SET status = 'completed' WHERE kpi_id = $1 AND type = 'kpi_entry'",
            [id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Value updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('API Error (/api/kpis/:id/actual POST):', err.message);
        res.status(500).json({ error: 'Failed to update value' });
    } finally {
        client.release();
    }
});

// Get History for a KPI
app.get('/api/kpis/:id/entries', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM kpi_entries WHERE kpi_id = $1 ORDER BY date_recorded DESC',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('API Error (/api/kpis/:id/entries GET):', err.message);
        res.status(500).json({ error: 'Failed to fetch history' });
    } finally {
        client.release();
    }
});

// Add History Entry
app.post('/api/kpis/:id/entries', async (req, res) => {
    const { id } = req.params;
    const { value, date, notes } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insert new entry
        await client.query(
            'INSERT INTO kpi_entries (kpi_id, value, date_recorded, notes) VALUES ($1, $2, $3, $4)',
            [id, value, date, notes]
        );

        // Check if this date is newer or equal to the latest recorded entry (to update current actual)
        // We find the entry with the latest date for this KPI
        const latestRes = await client.query(
            'SELECT value, date_recorded FROM kpi_entries WHERE kpi_id = $1 ORDER BY date_recorded DESC LIMIT 1',
            [id]
        );

        // Update main KPI actual value AND last_updated to reflect the latest entry's date
        if (latestRes.rows.length > 0) {
            await client.query(
                'UPDATE kpis SET actual_value = $1, last_updated = $2 WHERE id = $3',
                [latestRes.rows[0].value, latestRes.rows[0].date_recorded, id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Entry added successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('API Error (/api/kpis/:id/entries POST):', err.message);
        res.status(500).json({ error: 'Failed to add entry' });
    } finally {
        client.release();
    }
});

// Update History Entry
app.put('/api/entries/:id', async (req, res) => {
    const { id } = req.params;
    const { value, date, notes } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get kpi_id before update
        const entryRes = await client.query('SELECT kpi_id FROM kpi_entries WHERE id = $1', [id]);
        if (entryRes.rows.length === 0) {
            throw new Error('Entry not found');
        }
        const kpiId = entryRes.rows[0].kpi_id;

        // Update the entry
        await client.query(
            'UPDATE kpi_entries SET value = $1, date_recorded = $2, notes = $3 WHERE id = $4',
            [value, date, notes, id]
        );

        // Recalculate latest value for the main KPI
        const latestRes = await client.query(
            'SELECT value, date_recorded FROM kpi_entries WHERE kpi_id = $1 ORDER BY date_recorded DESC LIMIT 1',
            [kpiId]
        );

        if (latestRes.rows.length > 0) {
            await client.query(
                'UPDATE kpis SET actual_value = $1, last_updated = $2 WHERE id = $3',
                [latestRes.rows[0].value, latestRes.rows[0].date_recorded, kpiId]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Entry updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('API Error (/api/entries/:id PUT):', err.message);
        res.status(500).json({ error: 'Failed to update entry' });
    } finally {
        client.release();
    }
});

// Delete Indicator
app.delete('/api/indicators/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Manual cleanup of notifications to bridge any FK schema issues
        await client.query('DELETE FROM notifications WHERE kpi_id = $1', [id]);

        const result = await client.query('DELETE FROM kpis WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            console.warn(`DELETE attempt on non-existent KPI ID: ${id}`);
            return res.status(404).json({ error: 'Indicator not found' });
        }

        await client.query('COMMIT');
        console.log(`Successfully deleted KPI ID: ${id} and its notifications`);
        res.json({ message: 'Indicator deleted' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('API Error (/api/indicators DELETE):', err.message);
        res.status(500).json({ error: 'Failed to delete: ' + err.message });
    } finally {
        client.release();
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
