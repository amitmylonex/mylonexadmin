import React from "react";
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="p-8 space-y-4" role="alert"><h1 className="font-semibold">The admin page could not be displayed.</h1><p>Reload to recover your session. Unsaved edits may need to be entered again.</p><button className="btn-primary" onClick={() => window.location.reload()}>Reload page</button></main>;
    return this.props.children;
  }
}
