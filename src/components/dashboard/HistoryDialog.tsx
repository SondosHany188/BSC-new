
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Calendar, Check, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays, isSameDay, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';

interface HistoryEntry {
    id: number;
    value: number;
    date_recorded: string;
    notes?: string;
}

interface KPIDetails {
    target_value: number;
    critical_limit: number;
    direction: 'up' | 'down';
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
    const [kpiDetails, setKpiDetails] = useState<KPIDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [calendarDays, setCalendarDays] = useState<{ date: Date; entry?: HistoryEntry; value: string }[]>([]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const kpiRes = await fetch(`http://localhost:3002/api/kpis/${kpiId}`);
            let startDateStr = "";
            if (kpiRes.ok) {
                const kpi = await kpiRes.json();
                startDateStr = kpi.start_date;
                setKpiDetails({
                    target_value: kpi.target_value,
                    critical_limit: kpi.critical_limit,
                    direction: kpi.direction,
                    period: kpi.period
                });
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
        const today = new Date();
        let start = startDateStr ? parseISO(startDateStr) : today;

        if (start > today) start = today;

        const days = [];
        let current = today;

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
                fetchHistory();
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            console.error("Failed to save entry:", err);
        }
    };

    // Calculate adaptive Y-axis domain
    const calculateYDomain = () => {
        if (!kpiDetails || chartData.length === 0) return [0, 100];

        const allValues = [
            ...chartData.map(d => d.value),
            kpiDetails.target_value,
            kpiDetails.critical_limit
        ];

        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const range = maxValue - minValue;
        const padding = range * 0.1; // 10% padding

        return [
            Math.floor(minValue - padding),
            Math.ceil(maxValue + padding)
        ];
    };

    const chartData = [...entries]
        .sort((a, b) => new Date(a.date_recorded).getTime() - new Date(b.date_recorded).getTime())
        .map(entry => ({
            date: format(parseISO(entry.date_recorded), 'dd MMM', { locale: ar }),
            value: entry.value,
            target: kpiDetails?.target_value || 0,
            critical: kpiDetails?.critical_limit || 0
        }));

    const yDomain = calculateYDomain();

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
            <DialogContent className="max-w-7xl h-[92vh] flex flex-col overflow-hidden" dir="rtl">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl">سجل القراءات - {kpiName}</DialogTitle>
                        {kpiDetails && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground font-medium">القطبية:</span>
                                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold shadow-lg ${kpiDetails.direction === 'up'
                                        ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white'
                                        : 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white'
                                    }`}>
                                    {kpiDetails.direction === 'up' ? (
                                        <>
                                            <TrendingUp className="w-4 h-4" />
                                            <span>تصاعدي ↑</span>
                                        </>
                                    ) : (
                                        <>
                                            <TrendingDown className="w-4 h-4" />
                                            <span>تنازلي ↓</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
                    {/* Entries List - Scrollable, shows 2 at a time */}
                    <div className="shrink-0 border-b border-border pb-2">
                        <div className="max-h-[180px] overflow-y-auto space-y-2 pr-2">
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

                    {/* Chart Section */}
                    {chartData.length > 0 && kpiDetails && (
                        <div className="flex-1 min-h-0 flex flex-col">
                            <h3 className="text-lg font-bold text-center text-slate-700 mb-3">الرسم البياني للأداء</h3>

                            <div className="flex-1 flex gap-3 min-h-0">
                                {/* Chart Container - Centered and Larger */}
                                <div className="flex-1 p-6 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 rounded-xl border-2 border-violet-300 shadow-xl min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 10, right: 15, left: 30, bottom: 25 }}>
                                            <defs>
                                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0.05} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#c084fc" strokeWidth={1.5} opacity={0.3} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 12, fill: '#581c87', fontWeight: 700 }}
                                                stroke="#7c3aed"
                                                strokeWidth={2.5}
                                                height={35}
                                                label={{
                                                    value: 'التاريخ',
                                                    position: 'insideBottom',
                                                    offset: 5,
                                                    style: { fontSize: 14, fontWeight: 'bold', fill: '#4c1d95' }
                                                }}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: '#581c87', fontWeight: 700 }}
                                                stroke="#7c3aed"
                                                strokeWidth={2.5}
                                                width={65}
                                                domain={yDomain}
                                                label={{
                                                    value: 'القيمة',
                                                    angle: -90,
                                                    position: 'insideLeft',
                                                    offset: 5,
                                                    style: { fontSize: 14, fontWeight: 'bold', fill: '#4c1d95' }
                                                }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                                    border: '3px solid #fb923c',
                                                    borderRadius: '14px',
                                                    direction: 'rtl',
                                                    padding: '14px',
                                                    boxShadow: '0 10px 25px rgba(251, 146, 60, 0.3)'
                                                }}
                                                labelStyle={{ fontWeight: 'bold', fontSize: '15px', color: '#581c87' }}
                                                itemStyle={{ fontSize: '14px', fontWeight: 700 }}
                                            />

                                            {/* Danger Zone Shading based on Polarity */}
                                            {kpiDetails.direction === 'down' ? (
                                                // Negative polarity: shade ABOVE critical line (bad zone)
                                                <ReferenceArea
                                                    y1={kpiDetails.critical_limit}
                                                    y2={yDomain[1]}
                                                    fill="#ef4444"
                                                    fillOpacity={0.15}
                                                    strokeOpacity={0}
                                                />
                                            ) : (
                                                // Positive polarity: shade BELOW critical line (bad zone)
                                                <ReferenceArea
                                                    y1={yDomain[0]}
                                                    y2={kpiDetails.critical_limit}
                                                    fill="#ef4444"
                                                    fillOpacity={0.15}
                                                    strokeOpacity={0}
                                                />
                                            )}

                                            {/* Reference Lines - Dashed */}
                                            <ReferenceLine
                                                y={kpiDetails.target_value}
                                                stroke="#10b981"
                                                strokeDasharray="10 5"
                                                strokeWidth={4}
                                            />
                                            <ReferenceLine
                                                y={kpiDetails.critical_limit}
                                                stroke="#ef4444"
                                                strokeDasharray="10 5"
                                                strokeWidth={4}
                                            />

                                            {/* Actual Values Line - Always Orange */}
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#fb923c"
                                                strokeWidth={5}
                                                fill="url(#colorValue)"
                                                dot={{
                                                    fill: '#fb923c',
                                                    r: 7,
                                                    strokeWidth: 4,
                                                    stroke: 'white'
                                                }}
                                                activeDot={{
                                                    r: 11,
                                                    strokeWidth: 5,
                                                    stroke: 'white',
                                                    fill: '#f97316',
                                                    filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.4))'
                                                }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Legend Box - Right Side (Smaller) */}
                                <div className="shrink-0 w-52">
                                    <div className="bg-white/95 backdrop-blur-md rounded-xl border-2 border-violet-300 shadow-2xl p-4 h-full">
                                        <h4 className="text-sm font-bold text-violet-900 mb-3 text-center border-b-2 border-violet-200 pb-2">مفتاح الرسم</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50">
                                                <div className="w-8 h-1 rounded-full bg-orange-500"></div>
                                                <span className="font-bold text-xs text-slate-800">القيمة الفعلية</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                                                <div className="w-8 h-1 bg-green-500 rounded-full" style={{ borderTop: '2px dashed #10b981' }}></div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs text-slate-800">المستهدف</span>
                                                    <span className="text-[10px] font-semibold text-green-700">({kpiDetails.target_value})</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
                                                <div className="w-8 h-1 bg-red-500 rounded-full" style={{ borderTop: '2px dashed #ef4444' }}></div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs text-slate-800">الحد الحرج</span>
                                                    <span className="text-[10px] font-semibold text-red-700">({kpiDetails.critical_limit})</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                                                <div className="w-8 h-5 bg-red-500/15 rounded border border-red-300"></div>
                                                <span className="font-bold text-[10px] text-slate-800">منطقة الخطر</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
