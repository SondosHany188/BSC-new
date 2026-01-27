import { Target, TrendingUp, Users, Building2 } from "lucide-react";
import { KPICard } from "./KPICard";
import { GaugeChart } from "./GaugeChart";

export function RightPanel() {
  return (
    <div className="h-full bg-muted/30 border-r border-border p-4 overflow-y-auto">
      <h3 className="text-lg font-semibold text-foreground mb-4">نظرة عامة</h3>
      
      {/* Overall Performance Gauge */}
      <div className="glass-card rounded-xl p-4 mb-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-3 text-center">
          نسبة الإنجاز الكلية
        </h4>
        <div className="flex justify-center">
          <GaugeChart value={68} size="lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="space-y-3">
        <KPICard
          title="المؤشرات النشطة"
          value="24"
          subtitle="من أصل 30 مؤشر"
          icon={Target}
          variant="default"
        />
        <KPICard
          title="الأهداف المحققة"
          value="12"
          subtitle="هذا الربع"
          icon={TrendingUp}
          trend="up"
          trendValue="15%"
          variant="success"
        />
        <KPICard
          title="المبادرات الجارية"
          value="8"
          subtitle="قيد التنفيذ"
          icon={Building2}
          variant="warning"
        />
        <KPICard
          title="فريق العمل"
          value="45"
          subtitle="موظف مشارك"
          icon={Users}
          variant="default"
        />
      </div>

      {/* Quick Stats */}
      <div className="mt-4 glass-card rounded-xl p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">
          توزيع المنظورات
        </h4>
        <div className="space-y-2">
          {[
            { name: "المالية", value: 88, color: "bg-success" },
            { name: "العملاء", value: 72, color: "bg-warning" },
            { name: "العمليات", value: 65, color: "bg-primary" },
            { name: "التعلم والنمو", value: 45, color: "bg-destructive" },
          ].map((item) => (
            <div key={item.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">{item.value}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(item.color, "h-full rounded-full transition-all duration-500")}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
