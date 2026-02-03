
CREATE TABLE IF NOT EXISTS kpi_entries (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
    value DECIMAL(15,2) NOT NULL,
    date_recorded DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster retrieval by KPI
CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_id ON kpi_entries(kpi_id);
-- Index for date ordering
CREATE INDEX IF NOT EXISTS idx_kpi_entries_date ON kpi_entries(date_recorded);
