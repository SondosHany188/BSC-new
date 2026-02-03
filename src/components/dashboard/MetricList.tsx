import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, Square, Circle, Trash2, Pencil } from "lucide-react";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { cn } from "@/lib/utils";
import { HistoryDialog } from "@/components/dashboard/HistoryDialog";

interface MetricItem {
  id: string;
  name: string;
  code?: string;
  period?: string;
  completionColor?: number;
  completion?: number;
  target?: number;
  currentValue?: number;
  status?: string;
  hasLink?: boolean;
}

interface MetricCategory {
  id: string;
  name: string;
  color: "red" | "green" | "yellow" | "gray";
  subcategories?: MetricSubCategory[];
  items?: MetricItem[];
}

interface MetricSubCategory {
  id: string;
  name: string;
  color: "red" | "green" | "yellow" | "gray";
  completion: number;
  items?: MetricItem[];
}

const colorMap = {
  red: "bg-destructive",
  green: "bg-success",
  yellow: "bg-warning",
  gray: "bg-muted-foreground",
};

export function MetricList() {
  const navigate = useNavigate();
  const { department: deptId } = useParams<{ department: string }>();
  const { departments } = useDepartments();
  const [categories, setCategories] = useState<MetricCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("No filter");

  const periodMap: Record<string, string> = {
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    quarterly: "ربع سنوي",
    annually: "سنوي",
    "يومي": "يومي",
    "أسبوعي": "أسبوعي",
    "شهري": "شهري",
    "ربع سنوي": "ربع سنوي",
    "سنوي": "سنوي"
  };

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/reports');
      const data = await response.json();

      const perspectivesList = ["المالي", "العملاء", "العمليات الداخلية", "التعلم والنمو"];
      const categoryMap: Record<string, MetricCategory> = {};

      const activeDept = departments.find(d => d.id === deptId);
      const activeDeptLabel = activeDept?.label;

      // Track the status of the goal with the highest weight for each perspective
      const perspectiveTopGoal: Record<string, { weight: number, color: "red" | "green" | "yellow" | "gray" }> = {};

      // Pre-populate with all perspectives
      perspectivesList.forEach(p => {
        categoryMap[p] = {
          id: p,
          name: p,
          color: "gray",
          subcategories: []
        };
      });

      data.forEach((row: any) => {
        // Filter by department if deptId is present
        if (activeDeptLabel && row.department !== activeDeptLabel) return;

        const catId = row.perspective;
        if (!categoryMap[catId]) {
          categoryMap[catId] = {
            id: catId,
            name: catId,
            color: "gray",
            subcategories: []
          };
        }

        const goalWeight = Number(row.goal_rate) || 0;
        const goalStatus = row.goal_completion >= 100 ? "green" : row.goal_completion >= 70 ? "yellow" : "red";

        // Update top goal tracking for perspective status
        if (!perspectiveTopGoal[catId] || goalWeight > perspectiveTopGoal[catId].weight) {
          perspectiveTopGoal[catId] = { weight: goalWeight, color: goalStatus as any };
        }

        let sub = categoryMap[catId].subcategories?.find(s => s.name === row.goal_name);
        if (!sub) {
          sub = {
            id: row.goal_id.toString(),
            name: row.goal_name,
            color: goalStatus,
            completion: row.goal_completion || 0,
            items: []
          };
          categoryMap[catId].subcategories?.push(sub);
        }

        sub.items?.push({
          id: row.kpi_id.toString(),
          name: row.indicator,
          code: `KPI-${row.kpi_id}`,
          period: periodMap[row.period?.toLowerCase()] || row.period || "سنوي",
          completion: Math.round(row.achievement),
          status: row.status,
          target: row.target,
          currentValue: row.actual,
          hasLink: true
        });
      });

      // Apply perspective color based on the top goal's status
      Object.keys(perspectiveTopGoal).forEach(catId => {
        if (categoryMap[catId]) {
          categoryMap[catId].color = perspectiveTopGoal[catId].color;
        }
      });

      setCategories(Object.values(categoryMap));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذا المؤشر؟")) return;

    try {
      const response = await fetch(`http://localhost:3002/api/indicators/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        console.log('KPI deleted from MetricList:', id);
        fetchData();
      } else {
        const errorData = await response.json();
        console.error('Delete failed in MetricList:', errorData);
        alert("فشل الحذف: " + (errorData.error || "خطأ غير معروف"));
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  useEffect(() => {
    fetchData();
  }, [deptId, departments]);
  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSubcategory = (id: string) => {
    setExpandedSubcategories((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="p-4 text-center">جاري التحميل...</div>;

  const statusColorMap = {
    green: "text-success",
    yellow: "text-warning",
    red: "text-destructive"
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="font-semibold text-foreground">المناظير</h3>
      </div>

      {/* Categories */}
      <div className="divide-y divide-border">
        {categories.map((category) => (
          <div key={category.id}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className={cn("w-3 h-3 rounded-sm", colorMap[category.color])} />
              {expandedCategories.includes(category.id) ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="font-medium text-sm text-right flex-1">{category.name}</span>
            </button>

            {/* Subcategories */}
            {expandedCategories.includes(category.id) && category.subcategories && (
              <div className="bg-muted/30">
                {category.subcategories.map((sub) => (
                  <div key={sub.id}>
                    <button
                      onClick={() => toggleSubcategory(sub.id)}
                      className="w-full flex items-center gap-2 px-6 py-3 hover:bg-muted/50 transition-colors border-t border-border/30 bg-muted/10"
                    >
                      <Circle className={cn("w-3 h-3", sub.color === "gray" ? "text-muted-foreground" : statusColorMap[sub.color as keyof typeof statusColorMap])} fill="currentColor" />
                      {sub.items && sub.items.length > 0 ? (
                        expandedSubcategories.includes(sub.id) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                        )
                      ) : null}
                      <span className="text-sm font-bold text-foreground text-right flex-1">الهدف: {sub.name}</span>
                      <div className="flex items-center gap-2 mr-4 ml-2">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">نسبة إنجاز الهدف:</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded bg-background border border-border", statusColorMap[sub.color as keyof typeof statusColorMap])}>
                          {Number(sub.completion).toFixed(1)}%
                        </span>
                      </div>
                    </button>

                    {/* Items table */}
                    {expandedSubcategories.includes(sub.id) && sub.items && sub.items.length > 0 && (
                      <div className="mx-4 mb-2 overflow-x-auto">
                        <table className="w-full text-xs border border-border rounded">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="px-2 py-1.5 text-center">خيارات</th>
                              <th className="px-2 py-1.5 text-right border-l border-border">الفترة الزمنية</th>
                              <th className="px-2 py-1.5 text-center border-l border-border">نسبة الإنجاز</th>
                              <th className="px-2 py-1.5 text-center border-l border-border">المستهدف</th>
                              <th className="px-2 py-1.5 text-center border-l border-border">القيمة الحالية</th>
                              <th className="px-2 py-1.5 text-right">الاسم</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sub.items.map((item) => (
                              <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                                <td className="px-2 py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <HistoryDialog
                                      kpiId={item.id}
                                      kpiName={item.name}
                                      onUpdate={fetchData}
                                    />
                                    <button
                                      onClick={() => navigate(`/indicators/edit/${item.id}`)}
                                      className="p-1 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground hover:text-primary"
                                      title="تعديل"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => handleDelete(item.id, e)}
                                      className="p-1 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive"
                                      title="حذف"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-right border-l border-border">{item.period}</td>
                                <td className="px-2 py-1.5 text-center border-l border-border font-bold">
                                  <div className="flex items-center justify-center gap-1">
                                    <span>{item.completion}%</span>
                                    <Circle className={cn("w-2 h-2", statusColorMap[item.status as keyof typeof statusColorMap])} fill="currentColor" />
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-center border-l border-border font-medium text-primary">{item.target}</td>
                                <td className="px-2 py-1.5 text-center border-l border-border font-medium text-success">{item.currentValue}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <span className="text-foreground font-medium">{item.name}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
