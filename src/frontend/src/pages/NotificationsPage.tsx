import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { useGuccora } from "../context/GuccoraContext";

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "Just now";
}

export function NotificationsPage() {
  const { userData, markNotificationRead, markAllRead } = useGuccora();
  const unread = userData.notifications.filter((n) => !n.isRead).length;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-white font-black font-display text-2xl">
            Notifications
          </h1>
          {unread > 0 && (
            <p className="text-gold text-xs font-semibold">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <Button
            onClick={markAllRead}
            variant="outline"
            className="border-gold/20 text-gold hover:bg-gold/10 text-xs h-8 px-3"
            data-ocid="notifications.mark_all_read.button"
          >
            <CheckCheck size={12} className="mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {userData.notifications.length === 0 ? (
        <div
          className="text-center py-12"
          data-ocid="notifications.list.empty_state"
        >
          <Bell size={40} className="mx-auto mb-3 text-gold/20" />
          <p className="text-[#606060] text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2" data-ocid="notifications.list.table">
          {userData.notifications.map((notif, i) => (
            <button
              type="button"
              key={notif.id}
              onClick={() => markNotificationRead(notif.id)}
              className={`w-full text-left rounded-2xl p-4 border transition-all ${
                notif.isRead
                  ? "border-white/5 opacity-60"
                  : "border-gold/20 hover:border-gold/40"
              }`}
              style={{ background: "#141414" }}
              data-ocid={`notifications.item.${i + 1}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    notif.isRead ? "bg-transparent" : "bg-gold"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-white font-semibold text-sm">
                      {notif.title}
                    </p>
                    <span className="text-[#505050] text-xs">
                      {timeAgo(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-[#808080] text-xs leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
