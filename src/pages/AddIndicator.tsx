import { useParams } from "react-router-dom";
import { IndicatorForm } from "@/components/dashboard/IndicatorForm";

export default function AddIndicator() {
    const { id } = useParams<{ id: string }>();

    return (
        <div className="p-6 overflow-y-auto h-full">
            <div className="max-w-[1600px] mx-auto">
                <IndicatorForm initialKpiId={id ? parseInt(id) : null} />
            </div>
        </div>
    );
}
