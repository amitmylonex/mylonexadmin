import { useSyncExternalStore } from "react";
import { errorNotifications } from "../services/error-notifications";
export function ApiErrorToasts() {
  const notices = useSyncExternalStore(errorNotifications.subscribe, errorNotifications.snapshot);
  return <div aria-live="polite" aria-label="API notifications" className="fixed bottom-4 right-4 z-[100] w-[calc(100%-2rem)] max-w-sm space-y-2">
    {notices.map(notice => <div key={notice.id} role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800 shadow-lg">
      <p className="flex-1">{notice.message}</p><button type="button" aria-label="Dismiss notification" onClick={() => errorNotifications.dismiss(notice.id)}>×</button>
    </div>)}
  </div>;
}
