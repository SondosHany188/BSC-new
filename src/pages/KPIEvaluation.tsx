import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, CheckCircle2 } from "lucide-react";

interface EvaluationTask {
    id: number;
    kpi_id: number;
    kpi_name: string;
    kpi_description: string;
    department_name: string;
    perspective_name: string;
    created_at: string;
    count: number;
    actual_value?: number;
}

export default function KPIEvaluation() {
    const [tasks, setTasks] = useState<EvaluationTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<number | null>(null);

    const fetchTasks = async () => {
        try {
            const response = await fetch('http://localhost:3002/api/notifications');
            const data = await response.json();
            setTasks(data);
        } catch (err) {
            console.error('Failed to fetch evaluation tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleUpdateValue = async (kpiId: number, value: string) => {
        setUpdating(kpiId);
        try {
            const response = await fetch(`http://localhost:3002/api/kpis/${kpiId}/actual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actual: Number(value) }),
            });
            if (response.ok) {
                // Remove task from list after successful update
                setTasks(prev => prev.filter(t => t.kpi_id !== kpiId));
            }
        } catch (err) {
            console.error('Failed to update KPI value:', err);
        } finally {
            setUpdating(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-lg font-bold">جاري تحميل المهام...</div>;

    return (
        <div className="p-6 overflow-y-auto animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="glass-card rounded-xl overflow-hidden bg-background border border-border shadow-lg">
                    <div className="table-header-gradient px-6 py-4">
                        <h2 className="text-xl font-bold text-white text-center">تقييم المؤشرات</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right" dir="rtl">
                            <thead className="bg-primary text-primary-foreground">
                                <tr>
                                    <th className="px-6 py-4 font-semibold border-l border-white/10">المؤشر</th>
                                    <th className="px-6 py-4 font-semibold border-l border-white/10 text-center">النطاقات المرجعية</th>
                                    <th className="px-6 py-4 font-semibold border-l border-white/10 text-center">تاريخ التنبيه</th>
                                    <th className="px-6 py-4 font-semibold border-l border-white/10 text-center">القيمة</th>
                                    <th className="px-6 py-4 font-semibold text-center">إجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-lg italic">
                                            لا توجد مؤشرات تتطلب التحديث حالياً
                                        </td>
                                    </tr>
                                ) : (
                                    tasks.map((task: any) => (
                                        <tr key={task.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 border-l border-border">
                                                <p className="font-bold text-foreground text-lg mb-1">{task.kpi_name}</p>
                                                <div className="flex gap-4 text-xs text-primary font-medium">
                                                    <span>الإدارة: {task.department_name}</span>
                                                    <span>المنظور: {task.perspective_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 border-l border-border text-center align-middle">
                                                <div className="flex flex-col items-center gap-1 text-xs">
                                                    <div className="flex gap-2">
                                                        <span className="text-success font-bold">المستهدف: {task.target_value}</span>
                                                        <span className="text-destructive font-bold">الحد الحرج: {task.critical_limit}</span>
                                                    </div>
                                                    <span className="text-muted-foreground italic">
                                                        (الاتجاه: {task.direction === 'up' ? 'تصاعدي ↑' : 'تنازلي ↓'})
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 border-l border-border text-center align-middle">
                                                {new Date(task.created_at).toLocaleDateString('ar-EG')}
                                                <span className="block text-[10px] text-red-500 font-bold">متأخر {task.count} يوم</span>
                                            </td>
                                            <td className="px-6 py-4 border-l border-border text-center align-middle">
                                                <div className="flex justify-center">
                                                    <Input
                                                        id={`input-${task.kpi_id}`}
                                                        placeholder="0"
                                                        className="w-24 text-center font-bold"
                                                        type="number"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center align-middle">
                                                <Button
                                                    size="sm"
                                                    className="gap-2"
                                                    disabled={updating === task.kpi_id}
                                                    onClick={() => {
                                                        const val = (document.getElementById(`input-${task.kpi_id}`) as HTMLInputElement)?.value;
                                                        if (val) handleUpdateValue(task.kpi_id, val);
                                                    }}
                                                >
                                                    {updating === task.kpi_id ? "جاري الحفظ..." : <><Save className="w-4 h-4" /> حفظ</>}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
