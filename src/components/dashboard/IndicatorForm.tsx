import { useState, useEffect } from "react";
import { Building2, HelpCircle, Save, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Target } from "lucide-react";
import { useDepartments } from "@/contexts/DepartmentsContext";
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

interface Goal {
  id: string;
  name: string;
  percentage: number;
}

export function IndicatorForm() {
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
      const response = await fetch(`http://localhost:3002/api/goals?departmentId=${deptId}&perspectiveName=${encodeURIComponent(pName)}`);
      const data = await response.json();
      setExistingGoals(data);
    } catch (err) {
      console.error('Failed to fetch goals:', err);
    }
  };

  useEffect(() => {
    if (selectedDepartment && selectedPerspective) {
      fetchExistingGoals(selectedDepartment, selectedPerspective);
    }
  }, [selectedDepartment, selectedPerspective]);

  const handleAddDepartment = async () => {
    if (newDepartmentName.trim()) {
      await addDepartment(newDepartmentName.trim());
      setNewDepartmentName("");
      setIsAddDepartmentOpen(false);
    }
  };

  const handleSaveIndicator = async () => {
    const payload = {
      departmentId: selectedDepartment,
      perspectiveName: perspectives.find(p => p.id === selectedPerspective)?.label,
      goalName,
      goalWeight: Number(goalWeight),
      indicatorName,
      description: indicatorDescription,
      target: Number(targetValue),
      actual: 0, // Initial actual value
      criticalLimit: Number(criticalLimit),
      unit,
      period,
      weight: Number(weight),
      direction
    };

    try {
      const response = await fetch('http://localhost:3002/api/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("تم حفظ المؤشر بنجاح");
        // Clear fields
        setIndicatorName("");
        setIndicatorDescription("");
        setGoalName("");
        setGoalWeight("0");
        setIsNewGoal(true);
        setCriticalLimit("100");
        await refreshDepartments();
        if (selectedDepartment && selectedPerspective) {
          fetchExistingGoals(selectedDepartment, selectedPerspective);
        }
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-right">
        <Save className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">تعريف مؤشر جديد</h2>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Form */}
        <div className="space-y-6">
          {/* Department Selection */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">الإدارة</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="flex-1 text-right bg-background">
                  <SelectValue placeholder="اختر الإدارة..." />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isAddDepartmentOpen} onOpenChange={setIsAddDepartmentOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background">
                  <DialogHeader>
                    <DialogTitle>إضافة إدارة جديدة</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>اسم الإدارة</Label>
                      <Input
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                        placeholder="أدخل اسم الإدارة..."
                        className="text-right"
                      />
                    </div>
                    <Button onClick={handleAddDepartment} className="w-full">
                      إضافة
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Perspective Selection */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">المنظور</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {perspectives.map((perspective) => (
                <label
                  key={perspective.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="perspective"
                    value={perspective.id}
                    checked={selectedPerspective === perspective.id}
                    onChange={(e) => {
                      setSelectedPerspective(e.target.value);
                      setIsNewGoal(true);
                      setGoalName("");
                      setGoalWeight("0");
                    }}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm text-foreground">{perspective.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Goal Section */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 text-right">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setIsNewGoal(!isNewGoal);
                    setGoalName("");
                    setGoalWeight("0");
                  }}
                >
                  {isNewGoal ? "استخدام هدف موجود" : "تعريف هدف جديد"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">الهدف الاستراتيجي</span>
                <Target className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-32">
                <Label className="text-right block mb-1 text-xs">وزن الهدف</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">%</span>
                  <Input
                    type="number"
                    value={goalWeight}
                    onChange={(e) => setGoalWeight(e.target.value)}
                    className="text-center h-10"
                    readOnly={!isNewGoal}
                  />
                </div>
              </div>
              <div className="flex-1">
                <Label className="text-right block mb-1 text-xs invisible">.</Label>
                {isNewGoal ? (
                  <Input
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="أدخل اسم الهدف الاستراتيجي الجديد..."
                    className="text-right h-10 border-primary"
                  />
                ) : (
                  <Select
                    value={goalName}
                    onValueChange={(val) => {
                      const g = existingGoals.find(x => x.name === val);
                      setGoalName(val);
                      if (g) setGoalWeight(g.weight.toString());
                    }}
                  >
                    <SelectTrigger className="w-full text-right bg-background h-10">
                      <SelectValue placeholder="اختر هدفاً موجوداً..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {existingGoals.length === 0 ? (
                        <div className="p-2 text-center text-xs text-muted-foreground">لا توجد أهداف معرفة سابقاً</div>
                      ) : (
                        existingGoals.map((g) => (
                          <SelectItem key={g.id} value={g.name}>
                            {g.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Indicator Details */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Save className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">تفاصيل المؤشر</span>
            </div>

            <div className="space-y-4">
              {/* Indicator Name & Direction */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block">الاتجاه</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={direction === "down" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDirection("down")}
                      className="flex-1"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={direction === "up" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDirection("up")}
                      className="flex-1"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">اسم المؤشر</Label>
                  <Input
                    value={indicatorName}
                    onChange={(e) => setIndicatorName(e.target.value)}
                    placeholder="مثلاً: نسبة رضا العملاء"
                    className="text-right"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-right block">وصف المؤشر</Label>
                <Input
                  value={indicatorDescription}
                  onChange={(e) => setIndicatorDescription(e.target.value)}
                  placeholder="وصف المؤشر (اختياري - يظهر عند التمرير في النتائج)"
                  className="text-right"
                />
              </div>

              {/* Thresholds: Target, Critical Limit, Min */}
              <div className="grid grid-cols-3 gap-4" dir="rtl">
                <div className="space-y-2">
                  <Label className="text-right block font-bold">الصغرى</Label>
                  <Input
                    type="number"
                    value="0"
                    readOnly
                    className="text-center bg-muted/50 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block font-bold">الحد الحرج</Label>
                  <Input
                    type="number"
                    value={criticalLimit}
                    onChange={(e) => setCriticalLimit(e.target.value)}
                    className="text-center font-bold"
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-right block font-bold">المستهدف</Label>
                  <Input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="text-center font-bold border-primary"
                  />
                </div>
              </div>

              {/* Unit, Period, Weight */}
              <div className="grid grid-cols-3 gap-4" dir="rtl">
                <div className="space-y-2">
                  <Label className="text-right block">وزن المؤشر</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">%</span>
                    <Input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="text-center"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">الفترة</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="bg-background text-right">
                      <SelectValue placeholder="اختر الفترة..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="quarterly">ربع سنوي</SelectItem>
                      <SelectItem value="half-yearly">نصف سنوي</SelectItem>
                      <SelectItem value="yearly">سنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block">الوحدة</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="bg-background text-right">
                      <SelectValue placeholder="اختر الوحدة..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="number">عدد</SelectItem>
                      <SelectItem value="days">يوم</SelectItem>
                      <SelectItem value="hours">ساعة</SelectItem>
                      <SelectItem value="currency">ريال</SelectItem>
                      <SelectItem value="degree">درجة</SelectItem>
                      <SelectItem value="scale">مقياس</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveIndicator}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3"
            size="lg"
          >
            <Save className="w-5 h-5 ml-2" />
            حفظ المؤشر
          </Button>
        </div>
      </div>
    </div>
  );
}
