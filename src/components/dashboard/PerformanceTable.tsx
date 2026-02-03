import { cn } from "@/lib/utils";

interface PerformanceRow {
  id: string;
  perspective: string;
  perspectiveCompletion: number;
  goal: string;
  goalCompletion: number;
  goalWeight: string;
  indicator: string;
  indicatorCode: string;
  weight: string;
  completion: number;
  status: string; // Add status field
  target: number;
  value: number;
}

interface PerformanceTableProps {
  title: string;
  data: PerformanceRow[];
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'green': return "status-cell-success";
    case 'yellow': return "status-cell-warning";
    case 'red': return "status-cell-danger";
    default: return "status-cell-muted";
  }
};

export function PerformanceTable({ title, data }: PerformanceTableProps) {
  // Group data by perspective
  const groupedData = data.reduce((acc, row) => {
    if (!acc[row.perspective]) {
      acc[row.perspective] = {
        perspectiveCompletion: row.perspectiveCompletion,
        goals: {},
      };
    }
    if (!acc[row.perspective].goals[row.goal]) {
      acc[row.perspective].goals[row.goal] = {
        goalCompletion: row.goalCompletion,
        goalWeight: row.goalWeight,
        rows: [],
      };
    }
    acc[row.perspective].goals[row.goal].rows.push(row);
    return acc;
  }, {} as Record<string, { perspectiveCompletion: number; goals: Record<string, { goalCompletion: number; goalWeight: string; rows: PerformanceRow[] }> }>);

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="table-header-gradient px-6 py-4">
        <h2 className="text-xl font-bold text-white text-center">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="px-3 py-3 text-right font-semibold border-l border-white/20">إسم المؤشر</th>
              <th className="px-3 py-3 text-right font-semibold border-l border-white/20">المنظور</th>
              <th className="px-3 py-3 text-center font-semibold border-l border-white/20">نسبة الانجاز المنظور</th>
              <th className="px-3 py-3 text-right font-semibold border-l border-white/20">الهدف</th>
              <th className="px-3 py-3 text-center font-semibold border-l border-white/20">نسبة انجاز الهدف</th>
              <th className="px-3 py-3 text-center font-semibold border-l border-white/20">وزن الهدف</th>
              <th className="px-3 py-3 text-center font-semibold border-l border-white/20">وزن المؤشر</th>
              <th className="px-3 py-3 text-center font-semibold border-l border-white/20">نسبة الانجاز</th>
              <th className="px-3 py-3 text-center font-semibold border-l border-white/20">المستهدف</th>
              <th className="px-3 py-3 text-center font-semibold">القيمة</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedData).map(([perspective, perspectiveData], perspectiveIdx) => {
              const goals = Object.entries(perspectiveData.goals);
              const totalPerspectiveRows = goals.reduce((sum, [_, g]) => sum + g.rows.length, 0);
              let perspectiveRowRendered = false;

              return goals.map(([goal, goalData], goalIdx) => {
                let goalRowRendered = false;

                return goalData.rows.map((row, rowIdx) => {
                  const showPerspective = !perspectiveRowRendered;
                  const showGoal = !goalRowRendered;
                  perspectiveRowRendered = true;
                  goalRowRendered = true;

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border hover:bg-muted/50 transition-colors",
                        (perspectiveIdx + goalIdx + rowIdx) % 2 === 0 ? "bg-background" : "bg-table-row-alt"
                      )}
                    >
                      {/* Indicator name - MOVED TO FIRST */}
                      <td className="px-3 py-3 text-right border-l border-border">
                        <span className="text-primary font-medium">{row.indicatorCode}</span>
                        <span className="text-foreground"> - {row.indicator}</span>
                      </td>

                      {/* Perspective cell */}
                      {showPerspective && (
                        <td
                          rowSpan={totalPerspectiveRows}
                          className="px-3 py-3 text-right border-l border-border align-middle"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <MiniGauge value={perspectiveData.perspectiveCompletion} />
                            <span className="text-xs font-medium">{perspective}</span>
                          </div>
                        </td>
                      )}

                      {/* Perspective completion */}
                      {showPerspective && (
                        <td
                          rowSpan={totalPerspectiveRows}
                          className="px-3 py-3 text-center border-l border-border align-middle font-bold"
                        >
                          {(perspectiveData.perspectiveCompletion).toFixed(1)}%
                        </td>
                      )}

                      {/* Goal cell */}
                      {showGoal && (
                        <td
                          rowSpan={goalData.rows.length}
                          className="px-3 py-3 text-right border-l border-border align-middle"
                        >
                          {goal}
                        </td>
                      )}

                      {/* Goal Completion cell */}
                      {showGoal && (
                        <td
                          rowSpan={goalData.rows.length}
                          className="px-3 py-3 text-center border-l border-border align-middle font-bold"
                        >
                          {row.goalCompletion.toFixed(1)}%
                        </td>
                      )}

                      {/* Goal weight */}
                      {showGoal && (
                        <td
                          rowSpan={goalData.rows.length}
                          className="px-3 py-3 text-center border-l border-border align-middle font-medium"
                        >
                          {goalData.goalWeight}
                        </td>
                      )}

                      {/* Weight */}
                      <td className="px-3 py-3 text-center border-l border-border font-medium">
                        {row.weight}
                      </td>

                      {/* Completion */}
                      <td className={cn("px-3 py-3 text-center border-l border-border font-bold", getStatusColor(row.status))}>
                        {row.completion.toFixed(2)}%
                      </td>

                      {/* Target */}
                      <td className="px-3 py-3 text-center border-l border-border">
                        {row.target}
                      </td>

                      {/* Value */}
                      <td className="px-3 py-3 text-center">
                        {row.value}
                      </td>
                    </tr>
                  );
                });
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniGauge({ value }: { value: number }) {
  const rotation = -90 + (value / 100) * 180;

  return (
    <div className="relative w-20 h-12 overflow-hidden">
      <svg viewBox="0 0 100 50" className="w-full h-full">
        <defs>
          <linearGradient id="miniGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0, 80%, 55%)" />
            <stop offset="50%" stopColor="hsl(45, 95%, 55%)" />
            <stop offset="100%" stopColor="hsl(142, 70%, 45%)" />
          </linearGradient>
        </defs>
        <path
          d="M 15 50 A 35 35 0 0 1 85 50"
          fill="none"
          stroke="url(#miniGaugeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <text x="12" y="48" fill="hsl(var(--foreground))" fontSize="8" textAnchor="middle">0%</text>
        <text x="88" y="48" fill="hsl(var(--foreground))" fontSize="8" textAnchor="middle">100%</text>
      </svg>
      <div
        className="absolute bottom-0 left-1/2 origin-bottom"
        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
      >
        <div className="w-0.5 h-8 bg-foreground rounded-full" />
        <div className="w-1.5 h-1.5 rounded-full bg-foreground -mt-0.5 -ml-[2px]" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
    </div>
  );
}
