import { ErrorBoundary } from "./components/ErrorBoundary";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ApiErrorToasts } from "./components/ApiErrorToasts";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary><App /><ApiErrorToasts /></ErrorBoundary>
  </React.StrictMode>
);
