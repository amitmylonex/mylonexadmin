// Deliberately no external dispatch until the shared retry-safe delivery integration is approved.
// This visible result prevents a persisted review decision being mistaken for an email/WhatsApp send.
export const notificationStatus={state:"not-dispatched",message:"Decision saved. Email/WhatsApp delivery is not enabled in this standalone Admin; arrange delivery through the established marketplace workflow."} as const;
