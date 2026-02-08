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

        // Add last_updated and created_at to kpis
        await client.query(`
            ALTER TABLE kpis 
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
        `);

        // Create notifications table with target_date
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
                message TEXT,
                type TEXT,
                status TEXT DEFAULT 'pending',
                count INTEGER DEFAULT 1,
                target_date DATE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Migration: Add target_date if missing
        await client.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_date DATE');
        // Add unique constraint for (kpi_id, target_date)
        try {
            await client.query('ALTER TABLE notifications ADD CONSTRAINT unique_kpi_date UNIQUE (kpi_id, target_date)');
        } catch (e) { /* already exists */ }

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
        await client.query("UPDATE kpis SET last_updated = NOW() WHERE last_updated IS NULL");

        // FIX: Set creation date based on the FIRST entry if it exists, otherwise leave it alone (or default to NOW via schema)
        // This prevents "ghost notifications" for dates before the KPI actually started tracking data.
        // FIX 2.0: "The Cleanup"
        // Step 1: Reset ANY variable that looks like our "2024" mistake back to NOW(). 
        // This fixes KPIs that have NO entries yet, stopping them from showing past notifications.
        await client.query("UPDATE kpis SET created_at = NOW() WHERE created_at < '2025-01-01'");

        // Step 2: For KPIs that DO have history, align their creation date to their first entry.
        // This ensures historical notifications work effectively for data we actually have.
        await client.query(`
            UPDATE kpis 
            SET created_at = subquery.first_entry
            FROM (SELECT kpi_id, MIN(date_recorded) as first_entry FROM kpi_entries GROUP BY kpi_id) as subquery
            WHERE kpis.id = subquery.kpi_id
        `);

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
        // Find daily KPIs
        const dailyKpis = await client.query("SELECT id, name, created_at FROM kpis WHERE period = 'daily'");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const kpi of dailyKpis.rows) {
            // Check last 7 days
            for (let i = 0; i < 7; i++) {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() - i);

                // Don't look before KPI was created (compare dates only to avoid timezone/hour issues)
                const kpiDate = new Date(kpi.created_at);
                kpiDate.setHours(0, 0, 0, 0);
                if (targetDate < kpiDate) continue;

                // FIX: Use local YYYY-MM-DD instead of toISOString() to avoid timezone shifts
                const dateStr = targetDate.toLocaleDateString('en-CA');

                // Check if entry exists for this date
                const entry = await client.query(
                    "SELECT id FROM kpi_entries WHERE kpi_id = $1 AND date_recorded = $2",
                    [kpi.id, dateStr]
                );

                if (entry.rows.length === 0) {
                    // Check if notification already exists
                    const existing = await client.query(
                        "SELECT id, status FROM notifications WHERE kpi_id = $1 AND target_date = $2",
                        [kpi.id, dateStr]
                    );

                    if (existing.rows.length === 0) {
                        const warningMsg = i > 0 ? ` (متأخر ${i} يوم)` : "";
                        await client.query(
                            "INSERT INTO notifications (kpi_id, message, type, target_date) VALUES ($1, $2, 'kpi_entry', $3)",
                            [kpi.id, `يرجى إضافة قيمة مؤشر ${kpi.name} لتاريخ ${dateStr}${warningMsg}`, dateStr]
                        );
                    }
                } else {
                    // Resolve notification if entry exists but notification is pending
                    await client.query(
                        "UPDATE notifications SET status = 'completed' WHERE kpi_id = $1 AND target_date = $2 AND status = 'pending'",
                        [kpi.id, dateStr]
                    );
                }
            }
        }

        // Aggressive Cleanup: Remove ANY legacy notifications (no target_date or old-style counts)
        // This ensures the user starts fresh with the new date-specific system.
        await client.query("DELETE FROM notifications WHERE target_date IS NULL OR count > 1");

        // Comprehensive Sync: Auto-complete ANY pending notification that now has a matching entry
        // We do this AFTER the deletion to ensure only valid, date-specific alerts remain.
        await client.query(`
            UPDATE notifications n
            SET status = 'completed'
            FROM kpi_entries e
            WHERE n.kpi_id = e.kpi_id 
            AND n.target_date = e.date_recorded
            AND n.status = 'pending'
        `);

        // FINAL CLEANUP: Delete any notifications that are somehow BEFORE the KPI was even created.
        // This enforces the "First Entry Rule" on existing alerts.
        await client.query(`
            DELETE FROM notifications n
            USING kpis k
            WHERE n.kpi_id = k.id
            AND n.target_date < k.created_at::date
        `);

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

        // 5. Trigger a refresh check for notifications
        await refreshNotifications();

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

// Setup test notifications (for testing purposes)
app.post('/api/notifications/setup-test', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('🧹 Cleaning all existing notifications...');
        await client.query("DELETE FROM notifications");

        console.log('📊 Getting daily KPIs...');
        const kpis = await client.query(`
            SELECT id, name FROM kpis 
            WHERE period = 'daily' 
            ORDER BY id 
            LIMIT 4
        `);

        if (kpis.rows.length < 4) {
            return res.status(400).json({ error: 'Not enough daily KPIs found. Need at least 4.' });
        }

        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        const results = {
            lateNotifications: [],
            todayNotifications: []
        };

        // Create 2 notifications for 2 days ago
        console.log('🔔 Creating 2 late notifications (2 days ago)...');
        for (let i = 0; i < 2; i++) {
            const kpi = kpis.rows[i];

            // Delete entries from 2 days ago onwards
            const deleted = await client.query(
                'DELETE FROM kpi_entries WHERE kpi_id = $1 AND date_recorded >= $2 RETURNING date_recorded',
                [kpi.id, twoDaysAgoStr]
            );

            // Create notification with created_at set to 2 days ago
            await client.query(
                `INSERT INTO notifications (kpi_id, message, type, count, created_at, status) 
                 VALUES ($1, $2, 'kpi_entry', 2, $3, 'pending')`,
                [kpi.id, `يرجى إضافة قيمة مؤشر ${kpi.name}`, twoDaysAgo]
            );

            results.lateNotifications.push({
                kpiId: kpi.id,
                kpiName: kpi.name,
                deletedEntries: deleted.rows.length,
                date: twoDaysAgoStr,
                daysLate: 2
            });
        }

        // Create 2 notifications for today
        console.log('🔔 Creating 2 notifications for today...');
        for (let i = 2; i < 4; i++) {
            const kpi = kpis.rows[i];

            // Delete today's entry if it exists
            const deleted = await client.query(
                'DELETE FROM kpi_entries WHERE kpi_id = $1 AND date_recorded = $2 RETURNING date_recorded',
                [kpi.id, today]
            );

            // Create notification for today
            await client.query(
                `INSERT INTO notifications (kpi_id, message, type, count, created_at, status) 
                 VALUES ($1, $2, 'kpi_entry', 0, NOW(), 'pending')`,
                [kpi.id, `يرجى إضافة قيمة مؤشر ${kpi.name}`]
            );

            results.todayNotifications.push({
                kpiId: kpi.id,
                kpiName: kpi.name,
                deletedEntries: deleted.rows.length,
                date: today,
                daysLate: 0
            });
        }

        console.log('✅ Test notifications setup complete');
        res.json({
            success: true,
            message: 'Test notifications created successfully',
            ...results
        });

    } catch (err) {
        console.error('Error setting up test notifications:', err.message);
        res.status(500).json({ error: 'Failed to setup test notifications', details: err.message });
    } finally {
        client.release();
    }
});


// Update KPI actual value and resolve notification - MOVED AND MERGED with line 724 implementation

// Get goals by department and perspective
app.get('/api/goals', async (req, res) => {
    const { department_id, perspectiveName } = req.query;
    try {
        const result = await pool.query(`
            SELECT g.id, g.name, g.weight 
            FROM goals g
            JOIN perspectives p ON g.perspective_id = p.id
            WHERE p.department_id = $1 AND p.name = $2
        `, [department_id, perspectiveName]);
        res.json(result.rows);
    } catch (err) {
        console.error('API Error (/api/goals GET):', err.message);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Add Goal (Manual Save from Card Builder)
app.post('/api/goals', async (req, res) => {
    const { name, department_id, perspective, weight } = req.body;

    // Map perspective ID to Arabic Label if necessary
    const perspectiveMap = {
        'financial': 'المالي',
        'customers': 'العملاء',
        'operations': 'العمليات الداخلية',
        'learning': 'التعلم والنمو'
    };

    const pName = perspectiveMap[perspective] || perspective;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Ensure Perspective exists
        let pRes = await client.query(
            'SELECT id FROM perspectives WHERE name = $1 AND department_id = $2',
            [pName, department_id]
        );
        let perspectiveId;
        if (pRes.rows.length === 0) {
            pRes = await client.query(
                'INSERT INTO perspectives (name, department_id) VALUES ($1, $2) RETURNING id',
                [pName, department_id]
            );
            perspectiveId = pRes.rows[0].id;
        } else {
            perspectiveId = pRes.rows[0].id;
        }

        // 2. Insert Goal
        const gRes = await client.query(
            'INSERT INTO goals (name, perspective_id, weight) VALUES ($1, $2, $3) RETURNING *',
            [name, perspectiveId, weight]
        );

        await client.query('COMMIT');
        res.status(201).json(gRes.rows[0]);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('CRITICAL ERROR (/api/goals POST):', {
            message: err.message,
            stack: err.stack,
            body: req.body
        });
        res.status(500).json({
            error: 'Failed to create goal',
            details: err.message,
            code: err.code // Include PG error code if available
        });
    } finally {
        client.release();
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
                    THEN NULL 
                    WHEN NOT EXISTS (SELECT 1 FROM kpi_entries WHERE kpi_id = k.id)
                    THEN NULL
                    ELSE k.actual_value 
                END as actual,
                k.critical_limit,
                k.weight as kpi_weight,
                k.direction,
                k.period,
                k.description,
                k.unit,
                (SELECT value FROM kpi_entries WHERE kpi_id = k.id ORDER BY date_recorded DESC, id DESC LIMIT 1 OFFSET 1) as previous_value
            FROM kpis k
            JOIN goals g ON k.goal_id = g.id
            JOIN perspectives p ON g.perspective_id = p.id
            JOIN departments d ON p.department_id = d.id
        `);

        const rows = kpisResult.rows;
        if (rows.length === 0) return res.json([]);

        // Calculate individual KPI status and achievement
        const processedKpis = rows.map(row => {
            let status = 'gray'; // Default to gray if no data
            let achievement = null; // Default to null (will be converted to 0 for aggregation but handled for display)

            // Strict null check for actual value
            const hasData = row.actual !== null;
            const actual = hasData ? Number(row.actual) : 0;
            const target = Number(row.target) || 0;
            const critical = Number(row.critical_limit) || 0;

            if (hasData) {
                if (row.direction === 'up') {
                    // Formula 1: Maximize (Up Arrow)
                    achievement = target > 0 ? (actual / target) * 100 : 0;

                    if (actual >= target) status = 'green';
                    else if (actual >= critical) status = 'yellow';
                    else status = 'red';
                } else {
                    // Formula 2: Minimize (Down Arrow)
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
            }

            return {
                ...row,
                status,
                achievement: achievement !== null ? Math.max(achievement, 0) : null,
                actual: hasData ? actual : null // Explicitly return null if no data
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
                    perspective_id: row.perspective_id,
                    hasData: false // Track if any KPI in this goal has data
                };
            }
            // Add weighted KPI achievement ONLY if it exists
            if (row.achievement !== null) {
                goalData[row.goal_id].totalAchievement += (row.achievement * (Number(row.kpi_weight) / 100));
                goalData[row.goal_id].hasData = true;
            }
        });

        // Formula 4: Perspective Achievement (P)
        // P = sum(Oj * Wobj)
        const perspectiveAcc = {};
        Object.keys(goalData).forEach(gid => {
            const gd = goalData[gid];
            const pid = gd.perspective_id;
            if (!perspectiveAcc[pid]) perspectiveAcc[pid] = { total: 0, hasData: false };

            // Only count goals that have data
            if (gd.hasData) {
                perspectiveAcc[pid].total += (gd.totalAchievement * (gd.weight / 100));
                perspectiveAcc[pid].hasData = true;
            }
        });

        const finalData = processedKpis.map(row => {
            const gd = goalData[row.goal_id];
            const pd = perspectiveAcc[row.perspective_id];

            return {
                ...row,
                goal_completion: gd.hasData ? gd.totalAchievement : null,
                perspective_completion: pd && pd.hasData ? pd.total : null
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
    const { actual, date } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const targetDate = date || new Date().toISOString().split('T')[0];

        // 1. Insert into history
        await client.query(
            'INSERT INTO kpi_entries (kpi_id, value, date_recorded, notes) VALUES ($1, $2, $3, $4)',
            [id, actual, targetDate, 'Notification Update']
        );

        // 2. Update Main KPI with the latest entry info
        const latestRes = await client.query(
            'SELECT value, date_recorded FROM kpi_entries WHERE kpi_id = $1 ORDER BY date_recorded DESC LIMIT 1',
            [id]
        );

        if (latestRes.rows.length > 0) {
            await client.query(
                'UPDATE kpis SET actual_value = $1, last_updated = $2 WHERE id = $3',
                [latestRes.rows[0].value, latestRes.rows[0].date_recorded, id]
            );
        }

        // 3. Mark notification as completed for THIS SPECIFIC DATE
        await client.query(
            "UPDATE notifications SET status = 'completed' WHERE kpi_id = $1 AND target_date = $2",
            [id, targetDate]
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

            // SYNC: Resolve notification regardless of date (even if it's in the past)
            // We use the input date directly to ensure we match the notification's target_date
            if (date) {
                await client.query(
                    "UPDATE notifications SET status = 'completed' WHERE kpi_id = $1 AND target_date = $2",
                    [id, date]
                );
            }
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

        // SYNC: Resolve notification for the processed date
        if (date) {
            await client.query(
                "UPDATE notifications SET status = 'completed' WHERE kpi_id = $1 AND target_date = $2",
                [kpiId, date]
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
