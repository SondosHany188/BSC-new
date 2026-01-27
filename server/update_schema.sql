-- Update schema for notifications
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
    message TEXT,
    type TEXT,
    status TEXT DEFAULT 'pending',
    count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure existing KPIs have a last_updated value
UPDATE kpis SET last_updated = NOW() WHERE last_updated IS NULL;
