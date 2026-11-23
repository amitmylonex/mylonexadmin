type Notice = { id: number; message: string };
let notices: Notice[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const errorNotifications = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  snapshot: () => notices,
  dismiss: (id: number) => { notices = notices.filter(notice => notice.id !== id); emit(); },
  show: (message: string) => {
    if (notices.some(notice => notice.message === message)) return;
    const id = ++nextId;
    notices = [...notices.slice(-3), { id, message }]; emit();
    setTimeout(() => errorNotifications.dismiss(id), 7000);
  },
};
