import { IndicatorForm } from "@/components/dashboard/IndicatorForm";

export default function Dashboard() {
  return (
    <div className="p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="glass-card rounded-xl p-6">
          <IndicatorForm />
        </div>
      </div>
    </div>
  );
}
