
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Calendar, Check, AlertCircle } from "lucide-react";
import { format, subDays, isSameDay, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

interface HistoryEntry {
    id: number;
    value: number;
    date_recorded: string;
    notes?: string;
}

interface KPIInfo {
    created_at: string;
    period: string;
}

interface HistoryDialogProps {
    kpiId: string;
    kpiName: string;
    onUpdate?: () => void;
}

export function HistoryDialog({ kpiId, kpiName, onUpdate }: HistoryDialogProps) {
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [calendarDays, setCalendarDays] = useState<{ date: Date; entry?: HistoryEntry; value: string }[]>([]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Fetch KPI details for start date
            const kpiRes = await fetch(`http://localhost:3002/api/kpis/${kpiId}`);
            let startDateStr = "";
            if (kpiRes.ok) {
                const kpi = await kpiRes.json();
                startDateStr = kpi.start_date;
            }

            const response = await fetch(`http://localhost:3002/api/kpis/${kpiId}/entries`);
            if (response.ok) {
                const data: HistoryEntry[] = await response.json();
                setEntries(data);
                generateCalendar(data, startDateStr);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            setLoading(false);
        }
    };

    const generateCalendar = (historyData: HistoryEntry[], startDateStr?: string) => {
        // Generate days from start date (or last 30 days if null) up to today
        const today = new Date();
        // Use provided start date, or fallback to today (prevents showing random past dates if no start date)
        let start = startDateStr ? parseISO(startDateStr) : today;

        // Safety: don't show future dates or invalid range
        if (start > today) start = today;

        const days = [];
        let current = today;

        // Loop backwards from today to start
        while (current >= start) {
            const existing = historyData.find(e => isSameDay(parseISO(e.date_recorded), current));
            days.push({
                date: current,
                entry: existing,
                value: existing ? existing.value.toString() : ""
            });
            current = subDays(current, 1);
        }
        setCalendarDays(days);
    };

    useEffect(() => {
        if (open) {
            fetchHistory();
        }
    }, [open, kpiId]);

    const handleValueChange = (index: number, val: string) => {
        const newDays = [...calendarDays];
        newDays[index].value = val;
        setCalendarDays(newDays);
    };

    const saveEntry = async (index: number) => {
        const item = calendarDays[index];
        if (!item.value) return;

        try {
            const dateStr = format(item.date, 'yyyy-MM-dd');
            let url = `http://localhost:3002/api/kpis/${kpiId}/entries`;
            let method = "POST";
            let body = { value: Number(item.value), date: dateStr, notes: "Manual Entry" };

            if (item.entry) {
                url = `http://localhost:3002/api/entries/${item.entry.id}`;
                method = "PUT";
            }

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                fetchHistory(); // Refresh to ensure sync
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            console.error("Failed to save entry:", err);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="p-1 hover:bg-secondary/10 rounded-md transition-colors text-muted-foreground hover:text-secondary"
                    title="سجل القراءات"
                >
                    <History className="w-3.5 h-3.5" />
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col" dir="rtl">
                <DialogHeader>
                    <DialogTitle>سجل القراءات - {kpiName}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-1">
                    <div className="space-y-2">
                        {loading ? (
                            <div className="text-center p-4">جاري التحميل...</div>
                        ) : (
                            calendarDays.map((day, idx) => (
                                <div key={idx} className={`flex items-center gap-4 p-3 rounded-lg border ${day.entry ? 'bg-muted/10 border-border' : 'bg-red-50/50 border-red-100'} transition-colors`}>
                                    <div className="flex items-center gap-3 w-40 shrink-0">
                                        <Calendar className={`w-4 h-4 ${day.entry ? 'text-muted-foreground' : 'text-red-400'}`} />
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">
                                                {format(day.date, "EEEE", { locale: ar })}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(day.date, "dd MMMM yyyy", { locale: ar })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <Input
                                            type="number"
                                            placeholder={day.entry ? "" : "إضافة قيمة..."}
                                            value={day.value}
                                            onChange={(e) => handleValueChange(idx, e.target.value)}
                                            className={`h-9 font-bold text-center ${!day.entry && !day.value ? 'border-dashed border-muted-foreground/40' : ''}`}
                                        />
                                    </div>

                                    <div className="w-20 shrink-0 flex justify-center gap-2">
                                        <Button
                                            size="sm"
                                            className="h-8 px-3"
                                            onClick={() => saveEntry(idx)}
                                            disabled={!day.value || (day.entry && day.value === day.entry.value.toString())}
                                        >
                                            حفظ
                                        </Button>
                                        {day.entry && (
                                            <div title="تم الحفظ" className="flex items-center justify-center">
                                                <Check className="w-5 h-5 text-green-500" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
