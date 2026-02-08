import { useState, useEffect } from "react";
import { Building2, HelpCircle, Save, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Target, FileText, ChevronDown, ChevronLeft, Circle, Download } from "lucide-react";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Goal {
  id: string;
  name: string;
  percentage: number;
}

interface KPIData {
  department: string;
  perspective: string;
  perspective_completion: number;
  goal_id: number;
  goal_name: string;
  goal_rate: number;
  goal_completion: number;
  kpi_id: number;
  indicator: string;
  description: string;
  target: number;
  actual: number;
  critical_limit: number;
  kpi_weight: number;
  direction: string;
  period: string;
  unit: string;
  status: string;
  achievement: number;
}

export function IndicatorForm({ initialKpiId }: { initialKpiId?: number | null }) {
  const { departments, addDepartment, refreshDepartments } = useDepartments();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedPerspective, setSelectedPerspective] = useState<string>("financial");
  const [goalName, setGoalName] = useState("");
  const [goalWeight, setGoalWeight] = useState("0");
  const [indicatorName, setIndicatorName] = useState("");
  const [indicatorDescription, setIndicatorDescription] = useState("");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [criticalLimit, setCriticalLimit] = useState("100");
  const [targetValue, setTargetValue] = useState("0");
  const [unit, setUnit] = useState("");
  const [period, setPeriod] = useState("");
  const [weight, setWeight] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [existingGoals, setExistingGoals] = useState<{ id: number, name: string, weight: number }[]>([]);
  const [isNewGoal, setIsNewGoal] = useState(true);
  const [allKPIs, setAllKPIs] = useState<KPIData[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [editingKpiId, setEditingKpiId] = useState<number | null>(null);

  const handleEditKPI = (kpi: KPIData) => {
    // Find department ID by label
    const dept = departments.find(d => d.label === kpi.department);
    const perspective = perspectives.find(p => p.label === kpi.perspective);

    if (dept) setSelectedDepartment(dept.id);
    if (perspective) setSelectedPerspective(perspective.id);

    setEditingKpiId(kpi.kpi_id);
    setIndicatorName(kpi.indicator);
    setIndicatorDescription(kpi.description);
    setGoalName(kpi.goal_name);
    setGoalWeight(kpi.goal_rate.toString());
    setTargetValue(kpi.target.toString());
    setCriticalLimit(kpi.critical_limit.toString());
    setUnit(kpi.unit);
    setPeriod(kpi.period?.toLowerCase());
    setWeight(kpi.kpi_weight.toString());
    setDirection(kpi.direction as "up" | "down");
    setIsNewGoal(false);

    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const periodMapArabic: Record<string, string> = {
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    quarterly: "ربع سنوي",
    annually: "سنوي",
  };

  const perspectives = [
    { id: "financial", label: "المالي" },
    { id: "customers", label: "العملاء" },
    { id: "operations", label: "العمليات الداخلية" },
    { id: "learning", label: "التعلم والنمو" },
  ];

  const fetchExistingGoals = async (deptId: string, perspectiveId: string) => {
    const pName = perspectives.find(p => p.id === perspectiveId)?.label;
    if (!deptId || !pName) return;

    try {
      const response = await fetch(`http://localhost:3002/api/goals?department_id=${deptId}&perspectiveName=${encodeURIComponent(pName)}`);
      const data = await response.json();
      setExistingGoals(data);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    }
  };

  const fetchSummaryData = async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch('http://localhost:3002/api/reports');
      const data = await response.json();
      setAllKPIs(data);
    } catch (err) {
      console.error('Failed to fetch summary data:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryData();
    if (selectedDepartment && selectedPerspective) {
      fetchExistingGoals(selectedDepartment, selectedPerspective);
    }
  }, [selectedDepartment, selectedPerspective]);

  useEffect(() => {
    if (initialKpiId && allKPIs.length > 0) {
      const kpi = allKPIs.find(k => k.kpi_id === initialKpiId);
      if (kpi) {
        handleEditKPI(kpi);
      }
    }
  }, [initialKpiId, allKPIs]);

  useEffect(() => {
    setExpandedPerspectives([]);
  }, [selectedDepartment]);

  const [kpiToDelete, setKpiToDelete] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteKPI = async () => {
    if (!kpiToDelete) return;
    try {
      const response = await fetch(`http://localhost:3002/api/indicators/${kpiToDelete}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        console.log('KPI deleted successfully:', kpiToDelete);
        setIsDeleteDialogOpen(false);
        setKpiToDelete(null);
        await fetchSummaryData();
        await refreshDepartments();
      } else {
        const errorData = await response.json();
        console.error('Delete failed:', errorData);
        alert('فشل الحذف: ' + (errorData.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      console.error('Failed to delete KPI:', err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handleAddDepartment = async () => {
    if (newDepartmentName.trim()) {
      await addDepartment(newDepartmentName.trim());
      setNewDepartmentName("");
      setIsAddDepartmentOpen(false);
    }
  };

  const handleSaveIndicator = async () => {
    if (!selectedDepartment || !indicatorName || !targetValue) {
      alert("يرجى إكمال البيانات الأساسية للمؤشر");
      return;
    }

    const targetNum = Number(targetValue);
    const criticalNum = Number(criticalLimit);

    // ZERO DIVISOR RULE
    if (targetNum === criticalNum) {
      alert("خطأ في إدخال البيانات: لا يمكن أن يساوي المستهدف الحد الحرج (Zero Divisor).");
      return;
    }

    // POSITIVE POLARITY RULES (direction === "up")
    if (direction === "up") {
      if (criticalNum < 0) {
        alert("خطأ في إدخال البيانات: في القطبية الموجبة، يجب أن يكون الحد الحرج أكبر من أو يساوي صفر.");
        return;
      }
      if (targetNum <= criticalNum) {
        alert("خطأ في إدخال البيانات: في القطبية الموجبة، يجب أن يكون المستهدف أكبر من الحد الحرج.");
        return;
      }
    }

    // NEGATIVE POLARITY RULES (direction === "down")
    if (direction === "down") {
      if (targetNum < 0) {
        alert("خطأ في إدخال البيانات: في القطبية السابة، يجب أن يكون المستهدف أكبر من أو يساوي صفر.");
        return;
      }
      if (criticalNum <= targetNum) {
        alert("خطأ في إدخال البيانات: في القطبية السالبة، يجب أن يكون الحد الحرج أكبر من المستهدف.");
        return;
      }
    }

    const payload = {
      departmentId: selectedDepartment,
      perspectiveName: perspectives.find(p => p.id === selectedPerspective)?.label,
      goalName,
      goalWeight: Number(goalWeight),
      indicatorName,
      description: indicatorDescription,
      target: targetNum,
      actual: editingKpiId ? undefined : 0,
      criticalLimit: criticalNum,
      unit,
      period,
      weight: Number(weight),
      direction
    };

    try {
      const url = editingKpiId
        ? `http://localhost:3002/api/indicators/${editingKpiId}`
        : "http://localhost:3002/api/indicators";

      const response = await fetch(url, {
        method: editingKpiId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(editingKpiId ? "تم تحديث المؤشر بنجاح" : "تم حفظ المؤشر بنجاح");
        // Clear fields
        setEditingKpiId(null);
        setIndicatorName("");
        setIndicatorDescription("");
        setGoalName("");
        setGoalWeight("0");
        setIsNewGoal(true);
        setCriticalLimit("100");
        setTargetValue("0");
        setWeight("");
        setUnit("");
        setPeriod("");

        await refreshDepartments();
        fetchSummaryData(); // Refresh summary
        if (selectedDepartment && selectedPerspective) {
          fetchExistingGoals(selectedDepartment, selectedPerspective);
        }
      } else {
        const errData = await response.json();
        alert(`خطأ: ${errData.error || "فشل الحفظ"}`);
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالخادم");
    }
  };

  const [expandedPerspectives, setExpandedPerspectives] = useState<string[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<string[]>([]);

  const togglePerspective = (name: string) => {
    setExpandedPerspectives(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const toggleGoal = (name: string) => {
    setExpandedGoals(prev =>
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    );
  };

  const getPerformanceRanges = (critical: number, target: number, unitStr: string) => {
    const unitLabel = unitStr === "percentage" ? "%" : (unitStr === "number" ? "عدد" : unitStr);
    const excellentMax = target + Math.round(target * 0.5); // Arbitrary max for display or just show target+

    return {
      weak: `0 - ${critical - 1}`,
      acceptable: `${critical} - ${target - 1}`,
      excellent: `${target} - ${excellentMax}`,
      unit: unitLabel
    };
  };

  const selectedDepartmentLabel = departments.find(d => d.id === selectedDepartment)?.label;
  const filteredKPIs = allKPIs.filter(k => k.department === selectedDepartmentLabel);

  // Group KPIs for summary
  const groupedSummary = perspectives.reduce((acc, p) => {
    acc[p.label] = {};
    return acc;
  }, {} as Record<string, Record<string, KPIData[]>>);

  filteredKPIs.forEach(kpi => {
    if (groupedSummary[kpi.perspective]) {
      if (!groupedSummary[kpi.perspective][kpi.goal_name]) {
        groupedSummary[kpi.perspective][kpi.goal_name] = [];
      }
      groupedSummary[kpi.perspective][kpi.goal_name].push(kpi);
    }
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start" dir="rtl">
      {/* Sidebar - Positioned on the left for RTL, but it's the 'new' element */}
      <div className="w-full lg:w-[400px] shrink-0 sticky top-0 space-y-6 order-2">
        <div className="glass-card rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>ملخص المؤشرات {selectedDepartmentLabel && <span className="text-primary mr-1">- {selectedDepartmentLabel}</span>}</span>
            </h3>
            {selectedDepartment && (
              <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">
                {filteredKPIs.length} مؤشر
              </span>
            )}
          </div>

          {!selectedDepartment ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>يرجى اختيار الإدارة لعرض المؤشرات</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pr-2 text-right">
              <div className="space-y-3 font-cairo">
                {Object.entries(groupedSummary).map(([perspective, goals]) => {
                  const kpisInPerspective = Object.values(goals).flat();
                  const isExpanded = expandedPerspectives.includes(perspective);

                  return (
                    <div key={perspective} className="border border-border rounded-lg overflow-hidden bg-background/50">
                      <button
                        onClick={() => togglePerspective(perspective)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors",
                          isExpanded ? "bg-primary/5 text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {perspective}
                          <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded-full">
                            {kpisInPerspective.length}
                          </span>
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-4 bg-card/30">
                          {Object.entries(goals).length === 0 ? (
                            <p className="text-[10px] text-center text-muted-foreground py-4">لا توجد مؤشرات لهذا المنظور</p>
                          ) : (
                            Object.entries(goals).map(([gName, kpis]) => (
                              <div key={gName} className="space-y-2">
                                <button
                                  onClick={() => toggleGoal(gName)}
                                  className="w-full flex items-center justify-between py-1.5 text-muted-foreground border-b border-border/30 hover:text-primary transition-colors group"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[14px] font-bold text-slate-700">{gName}</span>
                                    {kpis.length > 0 && (
                                      <span className="bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/10 text-[10px]">
                                        وزن الهدف: {kpis[0].goal_rate}%
                                      </span>
                                    )}
                                  </div>
                                  {expandedGoals.includes(gName) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />}
                                </button>

                                {expandedGoals.includes(gName) && (
                                  <div className="space-y-3 pt-2">
                                    {kpis.map((kpi) => {
                                      const unitDisplay = kpi.unit === "currency" ? "ريال" : (kpi.unit === "percentage" ? "%" : (kpi.unit === "number" ? "" : kpi.unit));
                                      return (
                                        <div
                                          key={kpi.kpi_id}
                                          className="bg-white rounded-xl border border-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] overflow-hidden text-[10px] font-cairo"
                                        >
                                          <div className="p-4 flex gap-4">
                                            {/* Actions column */}
                                            <div className="flex flex-col gap-2 shrink-0">
                                              <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-transform active:scale-95"
                                                onClick={() => handleEditKPI(kpi)}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-transform active:scale-95"
                                                onClick={() => {
                                                  setKpiToDelete(kpi.kpi_id);
                                                  setIsDeleteDialogOpen(true);
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>

                                            {/* Content area */}
                                            <div className="flex-1 space-y-3 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={cn(
                                                  "px-2 py-0.5 rounded-full font-bold text-[9px] border",
                                                  kpi.direction === "up" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                                                )}>
                                                  {kpi.direction === "up" ? "ايجابي" : "سلبي"}
                                                </span>
                                                <span className="font-bold text-[12px] text-slate-800 truncate">{kpi.indicator}</span>
                                                <Target className="w-4 h-4 text-blue-500 opacity-60 shrink-0" />
                                              </div>

                                              <p className="text-slate-400 font-medium truncate mb-2" title={kpi.description}>{kpi.description || "لا يوجد وصف"}</p>

                                              <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-slate-50 border border-slate-100 flex items-center gap-1 px-2 py-1.5 rounded-md text-slate-600">
                                                  <span className="font-bold text-blue-600 shrink-0 text-[9px]">وزن المؤشر:</span>
                                                  <span className="font-bold">{kpi.kpi_weight}%</span>
                                                </div>
                                                <div className="bg-white/60 border border-slate-100 flex items-center gap-1 px-2 py-1.5 rounded-md text-slate-600">
                                                  <span className="font-bold text-blue-600 shrink-0 text-[9px]">فترة:</span>
                                                  <span className="font-bold">{periodMapArabic[kpi.period?.toLowerCase()] || kpi.period}</span>
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 mt-2">
                                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-md text-center">
                                                  <span className="block text-slate-500 text-[9px] mb-0.5">المستهدف:</span>
                                                  <span className="block font-bold text-slate-700">{kpi.target} {unitDisplay}</span>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-md text-center">
                                                  <span className="block text-slate-500 text-[9px] mb-0.5">الفعلي:</span>
                                                  <span className="block font-bold text-slate-700">{kpi.actual || 0} {unitDisplay}</span>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-md text-center">
                                                  <span className="block text-slate-500 text-[9px] mb-0.5">الحد الحرج:</span>
                                                  <span className="block font-bold text-slate-700">{kpi.critical_limit} {unitDisplay}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Form - Focused and centered in its container */}
      <div className="flex-1 max-w-6xl mx-auto order-1">
        <div className="glass-card rounded-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8 border-b pb-6">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {editingKpiId ? "تعديل مؤشر أداء" : "إضافة مؤشر أداء جديد"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {editingKpiId ? "قم بتعديل بيانات المؤشر الحالي وحفظ التغييرات" : "قم بتعريف مؤشر أداء جديد وربطه بالهدف الاستراتيجي"}
              </p>
            </div>
          </div>

          <div className="space-y-8 font-cairo">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-bold pr-1 text-primary">الإدارة</Label>
                <div className="flex gap-2">
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="h-11 bg-background/50 text-right" dir="rtl">
                      <SelectValue placeholder="اختر الإدارة المالك للمؤشر..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id} className="text-right flex justify-end">
                          <span className="w-full text-right" dir="rtl">{dept.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={isAddDepartmentOpen} onOpenChange={setIsAddDepartmentOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" className="h-11 w-11 shrink-0">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-right font-bold">إضافة إدارة جديدة</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2 text-right">
                          <Label className="font-bold text-sm">اسم الإدارة</Label>
                          <Input
                            value={newDepartmentName}
                            onChange={(e) => setNewDepartmentName(e.target.value)}
                            placeholder="أدخل اسم الإدارة..."
                            className="text-right h-11"
                          />
                        </div>
                        <Button onClick={handleAddDepartment} className="w-full h-11 font-bold">
                          حفظ الإدارة
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold pr-1 text-primary">المنظور الاستراتيجي</Label>
                <RadioGroup
                  value={selectedPerspective}
                  onValueChange={(val) => {
                    setSelectedPerspective(val);
                    setIsNewGoal(true);
                    setGoalName("");
                    setGoalWeight("0");
                  }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2"
                >
                  {perspectives.map((p) => (
                    <div key={p.id} className="relative h-full">
                      <RadioGroupItem
                        value={p.id}
                        id={p.id}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={p.id}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-muted bg-background hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary transition-all cursor-pointer text-center font-bold text-xs h-full min-h-[44px]"
                      >
                        {p.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border/50 bg-muted/20 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  الهدف الاستراتيجي المرتبط
                </Label>
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs font-bold text-primary"
                  onClick={() => {
                    setIsNewGoal(!isNewGoal);
                    setGoalName("");
                    setGoalWeight("0");
                  }}
                >
                  {isNewGoal ? "اختر من الأهداف الحالية" : "إضافة هدف جديد"}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  {isNewGoal ? (
                    <Input
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      placeholder="أدخل مسمى الهدف الاستراتيجي..."
                      className="text-right h-11 bg-background"
                    />
                  ) : (
                    <Select value={goalName} onValueChange={(val) => {
                      const g = existingGoals.find(x => x.name === val);
                      setGoalName(val);
                      if (g) setGoalWeight(g.weight.toString());
                    }}>
                      <SelectTrigger className="text-right h-11 bg-background">
                        <SelectValue placeholder="اختر هدفاً من القائمة..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingGoals.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">لا توجد أهداف معرفة لهذه الإدارة</div>
                        ) : (
                          existingGoals.map((g) => (
                            <SelectItem key={g.id} value={g.name} className="text-right font-medium">
                              {g.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {isNewGoal && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold pr-1">وزن الهدف الحالي</Label>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          value={goalWeight}
                          onChange={(e) => setGoalWeight(e.target.value)}
                          placeholder="الأهمية"
                          className="text-center h-11 font-bold bg-background pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 px-3"
                        onClick={async () => {
                          if (!goalName.trim() || !selectedDepartment || !selectedPerspective) {
                            alert("يرجى إدخال اسم الهدف واختيار الإدارة والمنظور");
                            return;
                          }
                          if (!goalWeight || Number(goalWeight) <= 0) {
                            alert("يرجى إدخال وزن الهدف");
                            return;
                          }

                          try {
                            const response = await fetch("http://localhost:3002/api/goals", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                name: goalName.trim(),
                                department_id: Number(selectedDepartment),
                                perspective: selectedPerspective,
                                weight: Number(goalWeight)
                              })
                            });

                            if (response.ok) {
                              alert("تم حفظ الهدف بنجاح");
                              // Refresh goals list using the shared function
                              await fetchExistingGoals(selectedDepartment, selectedPerspective);

                              // Switch to selection mode so the user can link KPIs
                              setIsNewGoal(false);
                            } else {
                              const errorData = await response.json().catch(() => ({ error: "فشل في قراءة استجابة الخادم" }));
                              console.error("Backend Error Details:", errorData);
                              alert(`فشل حفظ الهدف: ${errorData.details || errorData.error || "خطأ غير معروف"}`);
                            }
                          } catch (err: any) {
                            console.error("Fetch Exception Details:", err);
                            alert(`خطأ فني: ${err.message || "لا يمكن الاتصال بالخادم"}\nيرجى التحقق من تشغيل Backend.`);
                          }
                        }}
                      >
                        <Save className="w-3.5 h-3.5 ml-1" />
                        حفظ
                      </Button>
                    </div>
                  </div>
                )}

                {!isNewGoal && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold pr-1">وزن الهدف الحالي</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={goalWeight}
                        onChange={(e) => setGoalWeight(e.target.value)}
                        placeholder="الأهمية"
                        readOnly={true}
                        className="text-center h-11 font-bold bg-background pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-border/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold pr-1">مسمى المؤشر</Label>
                  <Input
                    value={indicatorName}
                    onChange={(e) => setIndicatorName(e.target.value)}
                    placeholder="أدخل مسمى المؤشر..."
                    className="text-right h-11 bg-background/50 shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold pr-1">حالة القطبية (الاتجاه)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={direction === "up" ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-11 font-bold gap-2",
                        direction === "up" && "bg-green-600 hover:bg-green-700"
                      )}
                      onClick={() => setDirection("up")}
                    >
                      <ArrowUp className="w-4 h-4" />
                      تصاعدي
                    </Button>
                    <Button
                      type="button"
                      variant={direction === "down" ? "destructive" : "outline"}
                      className="flex-1 h-11 font-bold gap-2"
                      onClick={() => setDirection("down")}
                    >
                      <ArrowDown className="w-4 h-4" />
                      تنازلي
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold pr-1">وصف المؤشر</Label>
                <textarea
                  value={indicatorDescription}
                  onChange={(e) => setIndicatorDescription(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-input bg-background/50 px-4 py-2 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm"
                  placeholder="وصف مختصر للمؤشر..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-xl border border-primary/10 bg-primary/5">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-primary pr-1">المستهدف</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="text-center h-14 text-2xl font-black bg-background border-primary/20"
                    />
                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-30" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-primary pr-1">الحد الحرج</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={criticalLimit}
                      onChange={(e) => setCriticalLimit(e.target.value)}
                      className="text-center h-14 text-2xl font-black bg-background border-primary/20"
                    />
                    <ArrowDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary opacity-30" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold pr-1">وحدة القياس</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="h-11 bg-background/50">
                      <SelectValue placeholder="اختر الوحدة..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage" className="text-right">% نسبة مئوية</SelectItem>
                      <SelectItem value="number" className="text-right"># عدد / قيمة</SelectItem>
                      <SelectItem value="days" className="text-right">أيام عمل</SelectItem>
                      <SelectItem value="hours" className="text-right">ساعات</SelectItem>
                      <SelectItem value="currency" className="text-right">ريال سعودي</SelectItem>
                      <SelectItem value="degree" className="text-right">درجة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold pr-1">دورية القياس</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="h-11 bg-background/50">
                      <SelectValue placeholder="الفترة..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily" className="text-right">يومي</SelectItem>
                      <SelectItem value="weekly" className="text-right">أسبوعي</SelectItem>
                      <SelectItem value="monthly" className="text-right">شهري</SelectItem>
                      <SelectItem value="quarterly" className="text-right">ربع سنوي</SelectItem>
                      <SelectItem value="annually" className="text-right">سنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold pr-1">وزن المؤشر (%)</Label>
                  <Input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="text-center h-11 font-bold bg-background/50 shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row gap-4">
              <Button onClick={handleSaveIndicator} className="flex-1 h-14 text-lg font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                {editingKpiId ? "تحديث مؤشر الأداء" : "اعتماد وحفظ المؤشر"}
              </Button>
              {editingKpiId && (
                <Button
                  variant="outline"
                  className="h-14 px-8 font-bold border-2"
                  onClick={() => {
                    setEditingKpiId(null);
                    setIndicatorName("");
                    setIndicatorDescription("");
                    setGoalName("");
                    setGoalWeight("0");
                    setIsNewGoal(true);
                    setCriticalLimit("100");
                    setTargetValue("0");
                    setWeight("");
                    setUnit("");
                    setPeriod("");
                  }}
                >
                  إلغاء التعديل
                </Button>
              )}
            </div>
          </div>

          {/* Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent dir="rtl" className="max-w-md rounded-2xl">
              <AlertDialogHeader>
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-destructive" />
                </div>
                <AlertDialogTitle className="text-center text-xl font-bold">هل أنت متأكد من الحذف؟</AlertDialogTitle>
                <AlertDialogDescription className="text-center py-2 text-base">
                  سيتم حذف مؤشر <span className="font-bold text-foreground">"{allKPIs.find(k => k.kpi_id === kpiToDelete)?.indicator}"</span> نهائياً. لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex flex-col sm:flex-row-reverse gap-3 pt-4">
                <AlertDialogAction
                  onClick={handleDeleteKPI}
                  className="bg-destructive text-white hover:bg-destructive/90 font-bold h-11"
                >
                  نعم، أحذف
                </AlertDialogAction>
                <AlertDialogCancel className="font-bold h-11 border-2">إلغاء</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div >
  );
}
