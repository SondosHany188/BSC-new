import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface KPIData {
  id: number;
  department: string;
  perspective: string;
  perspective_completion: number;
  goal_id: number;
  goal_name: string;
  goal_completion: number;
  indicator: string;
  target: number;
  actual: number;
  previous_value: number | null;
  status: string;
  achievement: number;
  direction: "up" | "down";
}

interface GoalInfo {
  id: number;
  name: string;
  completion: number;
  status: 'green' | 'yellow' | 'red';
  kpis: KPIData[];
}

interface PerspectiveGroup {
  name: string;
  completion: number;
  goals: GoalInfo[];
}

export default function StrategicMap() {
  const { department: deptId } = useParams<{ department: string }>();
  const { departments } = useDepartments();
  const [data, setData] = useState<PerspectiveGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Professional Solid Colors with Flat Shadows & Unified Black Text
  const getStatusStyle = (status: 'green' | 'yellow' | 'red' | 'empty' | 'no-kpi') => {
    switch (status) {
      case 'green': return {
        bg: "bg-[#2E7D32]",
        border: "border-[#757575]",
        text: "text-black",
        shadow: "shadow-[2px_2px_0px_rgba(0,0,0,0.1)]",
      };
      case 'yellow': return {
        bg: "bg-[#F1F10E]",
        border: "border-[#757575]",
        text: "text-black",
        shadow: "shadow-[2px_2px_0px_rgba(0,0,0,0.1)]",
      };
      case 'red': return {
        bg: "bg-[#FF0000]",
        border: "border-[#757575]",
        text: "text-black",
        shadow: "shadow-[2px_2px_0_rgba(0,0,0,0.1)]",
      };
      case 'no-kpi': return {
        bg: "bg-white",
        border: "border-slate-300",
        text: "text-black",
        shadow: "shadow-[1px_1px_0_rgba(0,0,0,0.05)]",
      };
      default: return {
        bg: "bg-slate-100",
        border: "border-slate-200",
        text: "text-slate-400",
        shadow: "shadow-none",
      };
    }
  };

  const getStatusFromCompletion = (val: number): 'green' | 'yellow' | 'red' => {
    if (val >= 90) return 'green';
    if (val >= 60) return 'yellow';
    return 'red';
  };

  const fetchStrategicData = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/reports');
      const allData: any[] = await response.json();

      const activeDept = departments.find(d => d.id === deptId);
      const activeDeptLabel = activeDept?.label;

      const filtered = allData.filter(row => !activeDeptLabel || row.department === activeDeptLabel);

      const standardPerspectives = ["العملاء", "العمليات الداخلية", "التعلم والنمو", "المالي"];

      const grouped: Record<string, { completion: number; goals: Record<number, GoalInfo> }> = {};

      standardPerspectives.forEach(p => {
        grouped[p] = { completion: 0, goals: {} };
      });

      filtered.forEach(row => {
        const normalizedP = (row.perspective === "العمليات") ? "العمليات الداخلية" : row.perspective;

        if (!grouped[normalizedP]) {
          grouped[normalizedP] = { completion: 0, goals: {} };
        }

        grouped[normalizedP].completion = row.perspective_completion || 0;

        if (!grouped[normalizedP].goals[row.goal_id]) {
          grouped[normalizedP].goals[row.goal_id] = {
            id: row.goal_id,
            name: row.goal_name,
            completion: row.goal_completion || 0,
            status: getStatusFromCompletion(row.goal_completion || 0),
            kpis: []
          };
        }

        grouped[normalizedP].goals[row.goal_id].kpis.push({
          id: row.kpi_id,
          department: row.department,
          perspective: normalizedP,
          perspective_completion: row.perspective_completion,
          goal_id: row.goal_id,
          goal_name: row.goal_name,
          goal_completion: row.goal_completion,
          indicator: row.indicator,
          target: row.target,
          actual: row.actual,
          previous_value: row.previous_value,
          status: row.status,
          achievement: row.achievement,
          direction: row.direction
        });
      });

      const finalGroups: PerspectiveGroup[] = standardPerspectives.map(name => {
        const pData = grouped[name];
        return {
          name,
          completion: pData.completion,
          goals: Object.values(pData.goals)
        };
      });

      setData(finalGroups);
    } catch (err) {
      console.error('Failed to fetch strategic map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategicData();
  }, [deptId, departments]);

  if (loading) return <div className="p-12 text-center text-lg font-bold font-cairo text-black">جاري تحميل الخريطة الاستراتيجية...</div>;

  const activeDeptName = departments.find(d => d.id === deptId)?.label || "";

  const renderTrendArrow = (kpi: KPIData) => {
    if (kpi.previous_value === null || kpi.previous_value === undefined) return <Minus className="w-4 h-4 text-slate-300" strokeWidth={3} />;

    const current = Number(kpi.actual);
    const prev = Number(kpi.previous_value);
    const dir = kpi.direction;

    if (current === prev) return <Minus className="w-4 h-4 text-slate-300" strokeWidth={3} />;

    const isImproved = dir === 'up' ? current > prev : current < prev;

    if (isImproved) {
      return <div className="bg-emerald-100 p-0.5 rounded"><ArrowUp className="w-4 h-4 text-emerald-600" strokeWidth={4} /></div>;
    } else {
      return <div className="bg-rose-100 p-0.5 rounded"><ArrowDown className="w-4 h-4 text-rose-600" strokeWidth={4} /></div>;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white select-none h-full font-cairo text-black" dir="rtl">
      {/* 0.58 Scale for absolute zero-scroll guarantee */}
      <div
        className="flex-1 flex flex-col p-2 pt-0 origin-top overflow-hidden"
        style={{ zoom: 0.58 }}
      >

        {/* Minimal Header */}
        <div className="flex flex-col items-center mb-2 shrink-0">
          <h1 className="text-4xl font-black tracking-tighter text-black mb-0.5 text-center uppercase">
            الخريطة الاستراتيجية {activeDeptName && <span className="text-black/30 font-bold">- {activeDeptName}</span>}
          </h1>
          <div className="h-0.5 w-16 bg-black/10 rounded-full" />
        </div>

        {/* Rows with Gutters */}
        <div className="flex-1 space-y-[8px] overflow-hidden flex flex-col justify-between">
          {data.map((per, idx) => {
            const isEmpty = per.goals.length === 0;
            const pStatus = isEmpty ? 'empty' : getStatusFromCompletion(per.completion);
            const pStyle = getStatusStyle(pStatus);

            return (
              <div
                key={per.name}
                className="flex flex-col md:flex-row items-stretch justify-start min-h-0 h-[24%] gap-6"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >

                {/* Perspective Side Anchor (Detached, with Bolder 3D Border: border-b-6 border-r-6) */}
                <div className={cn(
                  "md:w-40 shrink-0 flex flex-col items-center justify-center text-center shadow-md transition-all duration-300 relative text-black px-2 py-4 rounded-[6px] border-2 border-[#1B2631]/30 border-b-6 border-r-6",
                  pStyle.bg
                )}>
                  <span className="opacity-60 text-[10px] font-bold tracking-widest mb-1 uppercase text-black">المنظور</span>
                  <h2 className="text-2xl font-black leading-tight mb-3 text-black">{per.name}</h2>
                  {!isEmpty && (
                    <div className="bg-white/30 text-black px-3 py-1 rounded-md text-xl font-bold border border-black/20 backdrop-blur-sm">
                      {per.completion.toFixed(1)}%
                    </div>
                  )}
                </div>

                {/* Goal Area (Separated Container with Grey Background) - Removed overflow-hidden to prevent 3D shadow clipping */}
                <div className="flex-1 h-full bg-[#F2F2F2] rounded-[8px] p-4 flex flex-col items-center justify-center relative border border-slate-200/40">
                  {isEmpty ? (
                    <div className="w-full flex justify-center py-2">
                      <p className="font-bold opacity-30 text-sm text-black">لا توجد أهداف استراتيجية متاحة حالياً</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-6 w-fit mx-auto justify-items-center items-center">
                      {per.goals.map((goal) => {
                        const hasNoKPIs = goal.kpis.length === 0;
                        const gStatus = hasNoKPIs ? 'no-kpi' : goal.status;
                        const gStyle = getStatusStyle(gStatus);

                        return (
                          <Popover key={goal.id}>
                            <PopoverTrigger asChild>
                              <div
                                className={cn(
                                  "relative flex flex-col px-4 py-2 rounded-[6px] border transition-all duration-300 w-full md:w-[290px] h-[140px] group cursor-pointer",
                                  gStyle.bg,
                                  gStyle.border,
                                  "text-black font-bold",
                                  gStyle.shadow,
                                  "hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
                                )}
                              >
                                {/* Hierarchy: Name top, Percentage centered/larger */}
                                <div className="text-[10px] font-bold opacity-50 mb-0.5 text-right text-black uppercase tracking-wider">
                                  الهدف الاستراتيجى
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 overflow-hidden">
                                  <h3 className={cn("font-black text-xl leading-snug text-center whitespace-normal break-words text-black max-w-full px-1")}>
                                    {goal.name}
                                  </h3>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black tabular-nums text-black">{goal.completion.toFixed(0)}</span>
                                    <span className="text-xl font-black opacity-30">%</span>
                                  </div>
                                </div>
                              </div>
                            </PopoverTrigger>

                            <PopoverContent
                              className="w-[550px] p-0 border border-[#757575] rounded-lg shadow-2xl overflow-hidden bg-white mt-1 font-cairo z-[100]"
                              side="bottom"
                              align="center"
                            >
                              {/* Row 1: Dept Name - Largest but refined */}
                              <div className="px-6 py-4 text-black font-black text-2xl border-b border-[#757575] bg-slate-50">
                                {activeDeptName}
                              </div>
                              {/* Row 2: Perspective / Goal - Mid-sized Font */}
                              <div className="bg-slate-100/50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                                <span className="text-slate-400 font-bold text-base">{per.name} /</span>
                                <span className="text-black font-black text-lg">{goal.name}</span>
                              </div>
                              <div className="bg-white p-1">
                                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                  {hasNoKPIs ? (
                                    <div className="p-8 text-center text-slate-400 font-bold text-base">لم يتم تعيين مؤشرات أداء لهذا الهدف بعد</div>
                                  ) : (
                                    goal.kpis.map((kpi) => (
                                      <div key={kpi.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors cursor-default border-b border-slate-100 last:border-0 group/row">
                                        {/* Row 3: KPIs - Smallest Font */}
                                        <div className={cn(
                                          "w-6 h-6 rounded-full shrink-0 shadow-sm border border-[#757575]",
                                          kpi.status === 'green' ? 'bg-[#2E7D32]' : kpi.status === 'yellow' ? 'bg-[#F1F10E]' : 'bg-[#FF0000]'
                                        )} />

                                        <div className="w-6 flex justify-center shrink-0">{renderTrendArrow(kpi)}</div>

                                        <div className="flex-1 font-black text-sm text-black leading-snug group-hover/row:text-primary transition-colors">
                                          {kpi.indicator}
                                        </div>

                                        <div className="text-base font-black text-black opacity-40">
                                          {kpi.achievement.toFixed(0)}%
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
