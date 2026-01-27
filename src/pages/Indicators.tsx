import { MetricList } from "@/components/dashboard/MetricList";

export default function Indicators() {
  return (
    <div className="p-6 overflow-y-auto">
      <div className="max-w-full mx-auto space-y-6">
        {/* Metric List */}
        <MetricList />
      </div>
    </div>
  );
}
