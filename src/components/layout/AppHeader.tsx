import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface AppHeaderProps {
  title?: string;
}

interface Notification {
  id: number;
  message: string;
  type: string;
  created_at: string;
  target_date?: string;
  count: number;
}

export function AppHeader({ title = "نظام بطاقات الأداء المتوازن" }: AppHeaderProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/notifications');
      const data = await response.json();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return date.toLocaleDateString('ar-EG');
  };

  return (
    <header className="gradient-header h-14 flex items-center justify-between px-6 shadow-md">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-header-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-header-foreground hover:bg-white/10 relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold text-sm text-right">الإشعارات ({notifications.length})</h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">لا توجد إشعارات جديدة</div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => notif.type === 'kpi_entry' && navigate('/notifications/kpi-evaluation')}
                    className="w-full text-right p-4 hover:bg-muted transition-colors border-b border-border last:border-0 block"
                  >
                    <p className="text-sm font-medium text-foreground mb-1">{notif.message}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {notif.target_date ? new Date(notif.target_date).toLocaleDateString('ar-EG') : formatTimeAgo(notif.created_at)}
                      </span>
                      {notif.target_date && (() => {
                        const target = new Date(notif.target_date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        // Calculate difference in days
                        const diffTime = today.getTime() - target.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays > 0) {
                          return (
                            <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                              متأخر {diffDays} يوم
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-white/20 mx-2" />
        <Button
          variant="ghost"
          size="sm"
          className="text-header-foreground hover:bg-white/10 gap-2"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <span>المستخدم</span>
        </Button>
      </div>
    </header>
  );
}
