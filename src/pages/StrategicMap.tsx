import { RightPanel } from "@/components/dashboard/RightPanel";

export default function StrategicMap() {
  return (
    <>
      <div className="p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-xl p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
              الخريطة الاستراتيجية
            </h1>

            {/* Strategic Map Visualization */}
            <div className="space-y-4">
              {[
                { name: "المالية", color: "bg-blue-500", goals: ["الاستخدام الأمثل للموارد المتاحة", "ضمان موارد دخل متنوعة ومستدامة"] },
                { name: "العملاء", color: "bg-green-500", goals: ["رفع مستوى رضا أصحاب المصلحة", "الارتقاء بسرعة وجودة انجاز المعاملات"] },
                { name: "العمليات الداخلية", color: "bg-orange-500", goals: ["الإدارة الفعالة للإيرادات", "رفع كفاءة دورة حياة المشاريع", "الرقابة الفعالة على المخزون"] },
                { name: "التعلم والنمو", color: "bg-purple-500", goals: ["الارتقاء بمستوى مهارات العاملين", "إيجاد بيئة عمل محفزة", "الاستخدام الأمثل للتقنية"] },
              ].map((perspective) => (
                <div key={perspective.name} className="border border-border rounded-lg p-4">
                  <div className={`${perspective.color} text-white px-4 py-2 rounded-lg mb-3 text-center font-semibold`}>
                    {perspective.name}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {perspective.goals.map((goal) => (
                      <div
                        key={goal}
                        className="bg-muted px-3 py-2 rounded-lg text-sm text-foreground border border-border hover:bg-accent transition-colors cursor-pointer"
                      >
                        {goal}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
