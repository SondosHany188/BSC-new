import { PerformanceTable } from "@/components/dashboard/PerformanceTable";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDepartments } from "@/contexts/DepartmentsContext";

export default function Reports() {
  const { department: deptId } = useParams<{ department: string }>();
  const { departments } = useDepartments();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/reports');
      const data = await response.json();

      const activeDept = departments.find(d => d.id === deptId);
      const activeDeptLabel = activeDept?.label;

      // Transform and filter backend data
      const transformed = data
        .filter((row: any) => !activeDeptLabel || row.department === activeDeptLabel)
        .map((row: any, index: number) => ({
          id: index.toString(),
          perspective: row.perspective,
          perspectiveCompletion: row.perspective_completion || 0,
          goal: row.goal_name,
          goalCompletion: row.goal_completion || 0,
          goalWeight: `${row.goal_rate || 0}%`,
          indicator: row.indicator,
          indicatorCode: `KPI-${index + 1}`,
          weight: `${row.kpi_weight}%`,
          completion: row.achievement || 0,
          status: row.status, // Add status from backend
          target: row.target,
          value: row.actual,
        }));

      setReportData(transformed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [deptId, departments]);

  if (loading) return <div className="p-8 text-center text-lg font-bold">جاري تحميل التقارير...</div>;

  return (
    <div className="p-6 overflow-y-auto animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <PerformanceTable
          title="تحليل نسبة الانجاز الكلية"
          data={reportData}
        />
      </div>
    </div>
  );
}
