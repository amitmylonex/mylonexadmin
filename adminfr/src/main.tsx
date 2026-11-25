import { ErrorBoundary } from "./components/ErrorBoundary";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ApiErrorToasts } from "./components/ApiErrorToasts";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./services/query-client";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}><ErrorBoundary><App /><ApiErrorToasts /></ErrorBoundary></QueryClientProvider>
  </React.StrictMode>
);
