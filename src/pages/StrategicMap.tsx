import { useEffect, useState } from "react";
import { Building2, Target, TrendingUp } from "lucide-react";

interface KPIData {
  perspective: string;
  goal_name: string;
}

export default function StrategicMap() {
  const [data, setData] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/reports');
      const kpis: KPIData[] = await response.json();

      const grouped: Record<string, Set<string>> = {
        "المنظور المالي": new Set(),
        "منظور العملاء": new Set(),
        "منظور العمليات الداخلية": new Set(),
        "منظور التعلم والنمو": new Set(),
      };

      // Map DB names to target labels
      const perspectiveMap: Record<string, string> = {
        "المالي": "المنظور المالي",
        "العملاء": "منظور العملاء",
        "العمليات الداخلية": "منظور العمليات الداخلية",
        "التعلم والنمو": "منظور التعلم والنمو"
      };

      kpis.forEach(kpi => {
        const label = perspectiveMap[kpi.perspective] || kpi.perspective;
        if (!grouped[label]) grouped[label] = new Set();
        grouped[label].add(kpi.goal_name);
      });

      const finalData: Record<string, string[]> = {};
      Object.entries(grouped).forEach(([key, set]) => {
        finalData[key] = Array.from(set);
      });

      setData(finalData);
    } catch (err) {
      console.error('Failed to fetch strategic map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const perspectiveConfigs = [
    { name: "المنظور المالي", color: "bg-blue-600", icon: TrendingUp },
    { name: "منظور العملاء", color: "bg-emerald-600", icon: Building2 },
    { name: "منظور العمليات الداخلية", color: "bg-orange-500", icon: Target },
    { name: "منظور التعلم والنمو", color: "bg-purple-600", icon: TrendingUp },
  ];

  if (loading) return <div className="p-12 text-center text-lg font-bold font-cairo">جاري تحميل الخريطة الاستراتيجية...</div>;

  return (
    <div className="p-6 overflow-y-auto animate-fade-in font-cairo" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="glass-card rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-3xl font-black text-slate-800 mb-2">
              الخريطة الاستراتيجية
            </h1>
            <div className="h-1.5 w-24 bg-primary rounded-full shadow-sm"></div>
          </div>

          <div className="space-y-6 relative">
            {/* Connection line decorator */}
            <div className="absolute left-1/2 top-4 bottom-4 w-1 bg-slate-100 -translate-x-1/2 hidden md:block opacity-50"></div>

            {perspectiveConfigs.map((config) => {
              const goals = data[config.name] || [];
              const Icon = config.icon;

              return (
                <div key={config.name} className="relative z-10 transition-all duration-300 hover:translate-y-[-4px]">
                  <div className="overflow-hidden bg-white rounded-xl border border-slate-100 shadow-md">
                    <div className={`${config.color} text-white px-6 py-4 flex items-center justify-between shadow-inner`}>
                      <h2 className="text-xl font-bold flex items-center gap-3">
                        <Icon className="w-6 h-6 opacity-80" />
                        {config.name}
                      </h2>
                      <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                        {goals.length} أهداف
                      </span>
                    </div>
                    <div className="p-6 flex flex-wrap gap-3 justify-center bg-slate-50/50">
                      {goals.length === 0 ? (
                        <p className="text-slate-400 text-sm italic py-2">لا توجد أهداف استراتيجية مضافة حالياً</p>
                      ) : (
                        goals.map((goal) => (
                          <div
                            key={goal}
                            className="bg-white px-5 py-3 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:bg-primary/[0.02] cursor-default text-center min-w-[140px]"
                          >
                            {goal}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
