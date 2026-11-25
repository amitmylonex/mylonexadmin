import { createFixedWindow } from "../../common/auth/fixed-window.js";
// Shared gateway limits are mandatory when deploying multiple replicas.
export const allowAdminWrite = createFixedWindow(60);
