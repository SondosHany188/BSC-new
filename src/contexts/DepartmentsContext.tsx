import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Target, Lightbulb, BarChart3, FileText, Users, Building, Plus } from "lucide-react";

export interface Department {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { id: string; label: string; href: string }[];
}

interface DepartmentsContextType {
  departments: Department[];
  addDepartment: (name: string) => Promise<void>;
  refreshDepartments: () => Promise<void>;
}

const DepartmentsContext = createContext<DepartmentsContextType | null>(null);

export function DepartmentsProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>([]);

  const refreshDepartments = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/departments');
      const data = await response.json();

      // Transform backend data to frontend hierarchy
      const grouped: Record<string, Department> = {};

      data.forEach((row: any) => {
        if (!grouped[row.dept_id]) {
          const id = row.dept_id.toString();
          grouped[row.dept_id] = {
            id: id,
            label: row.dept_name,
            icon: row.icon_name === 'Target' ? Target :
              row.icon_name === 'Lightbulb' ? Lightbulb :
                row.icon_name === 'BarChart3' ? BarChart3 :
                  row.icon_name === 'FileText' ? FileText :
                    row.icon_name === 'Users' ? Users : Building,
            children: [
              { id: `${id}-indicators`, label: "١- المؤشرات", href: `/${id}/indicators` },
              { id: `${id}-reports`, label: "٢- التقارير", href: `/${id}/reports` },
            ]
          };
        }
      });

      setDepartments(Object.values(grouped));
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  };

  useEffect(() => {
    refreshDepartments();
  }, []);

  const addDepartment = async (name: string) => {
    try {
      const response = await fetch('http://localhost:3002/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (response.ok) {
        await refreshDepartments();
      }
    } catch (err) {
      console.error("Failed to add department", err);
    }
  };

  return (
    <DepartmentsContext.Provider value={{ departments, addDepartment, refreshDepartments }}>
      {children}
    </DepartmentsContext.Provider>
  );
}

export function useDepartments() {
  const context = useContext(DepartmentsContext);
  if (!context) {
    throw new Error("useDepartments must be used within a DepartmentsProvider");
  }
  return context;
}
