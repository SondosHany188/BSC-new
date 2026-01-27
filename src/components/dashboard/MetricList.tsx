import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, Square, Circle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  items?: MetricItem[];
}

const colorMap = {
  red: "bg-destructive",
  green: "bg-success",
  yellow: "bg-warning",
  gray: "bg-muted-foreground",
};

export function MetricList() {
  const [categories, setCategories] = useState<MetricCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("No filter");

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/reports');
      const data = await response.json();

      const categoryMap: Record<string, MetricCategory> = {};

      data.forEach((row: any) => {
        const catId = row.perspective;
        if (!categoryMap[catId]) {
          categoryMap[catId] = {
            id: catId,
            name: catId,
            color: row.perspective_completion >= 70 ? "green" : row.perspective_completion >= 40 ? "yellow" : "red",
            subcategories: []
          };
        }

        let sub = categoryMap[catId].subcategories?.find(s => s.name === row.goal_name);
        if (!sub) {
          sub = {
            id: row.goal_id.toString(),
            name: row.goal_name,
            color: row.goal_completion >= 70 ? "green" : row.goal_completion >= 40 ? "yellow" : "red",
            items: []
          };
          categoryMap[catId].subcategories?.push(sub);
        }

        sub.items?.push({
          id: row.kpi_id.toString(),
          name: row.indicator,
          code: `KPI-${row.kpi_id}`,
          period: row.period || "سنوي",
          completion: Math.round(row.achievement),
          status: row.status, // Use status from backend
          target: row.target,
          currentValue: row.actual,
          hasLink: true
        });
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
        fetchData();
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
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
        <h3 className="font-semibold text-foreground">قائمة المؤشرات</h3>
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
                      <Circle className={cn("w-3 h-3", sub.color === "gray" ? "text-muted-foreground" : `text-${sub.color}-500`)} fill="currentColor" />
                      {sub.items && sub.items.length > 0 ? (
                        expandedSubcategories.includes(sub.id) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                        )
                      ) : null}
                      <span className="text-sm font-bold text-foreground text-right flex-1">الهدف: {sub.name}</span>
                    </button>

                    {/* Items table */}
                    {expandedSubcategories.includes(sub.id) && sub.items && sub.items.length > 0 && (
                      <div className="mx-4 mb-2 overflow-x-auto">
                        <table className="w-full text-xs border border-border rounded">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="px-2 py-1.5 text-center">حذف</th>
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
                                  <button
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="p-1 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
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
