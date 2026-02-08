-- Cleanup KPI Entries for Pending Notifications
-- This script removes KPI entries for dates that have pending notifications
-- Run this once to sync the data

-- Show what will be deleted (preview)
SELECT 
    ke.id as entry_id,
    ke.kpi_id,
    k.name as kpi_name,
    ke.date_recorded,
    ke.value,
    n.created_at as notification_date,
    n.count as days_late
FROM kpi_entries ke
JOIN kpis k ON ke.kpi_id = k.id
JOIN notifications n ON ke.kpi_id = n.kpi_id
WHERE n.status = 'pending'
AND ke.date_recorded >= n.created_at::date
ORDER BY ke.kpi_id, ke.date_recorded;

-- Uncomment the following line to actually delete the entries:
-- DELETE FROM kpi_entries 
-- WHERE id IN (
--     SELECT ke.id
--     FROM kpi_entries ke
--     JOIN notifications n ON ke.kpi_id = n.kpi_id
--     WHERE n.status = 'pending'
--     AND ke.date_recorded >= n.created_at::date
-- );
