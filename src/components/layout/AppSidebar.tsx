import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Menu,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/contexts/DepartmentsContext";

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { departments } = useDepartments();
  const [expandedItems, setExpandedItems] = useState<string[]>(["financial"]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isChildActive = (children?: { href: string }[]) => {
    if (!children) return false;
    return children.some((child) => location.pathname === child.href);
  };

  return (
    <aside
      className={cn(
        "gradient-sidebar h-screen flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="w-full text-right font-bold text-sidebar-foreground text-lg">نظام القياس</div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-5 h-5 text-sidebar-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-2 mb-4">
          <NavLink
            to="/indicators/add"
            className={({ isActive }) =>
              cn(
                "sidebar-item w-full",
                isActive && "sidebar-item-active"
              )
            }
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="flex-1 text-right">بناء بطاقات الأداء المتوازن</span>}
          </NavLink>
        </div>
        <ul className="space-y-1 px-2">
          {departments.map((item) => (
            <li key={item.id}>
              <div>
                <button
                  onClick={() => toggleExpand(item.id)}
                  className={cn(
                    "sidebar-item w-full",
                    (expandedItems.includes(item.id) || isChildActive(item.children)) &&
                    "sidebar-item-active"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-right">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform",
                          expandedItems.includes(item.id) && "rotate-180"
                        )}
                      />
                    </>
                  )}
                </button>
                {!isCollapsed && expandedItems.includes(item.id) && (
                  <ul className="mt-1 mr-4 space-y-1 border-r-2 border-sidebar-border pr-4">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink
                          to={child.href}
                          className={({ isActive }) =>
                            cn(
                              "sidebar-item text-sm",
                              isActive && "sidebar-item-active"
                            )
                          }
                        >
                          <ChevronLeft className="w-3 h-3" />
                          <span>{child.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
