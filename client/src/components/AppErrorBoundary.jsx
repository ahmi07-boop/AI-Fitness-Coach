import { Component } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("FitCoach UI error boundary caught an exception:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.assign("/dashboard");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-error-boundary" role="alert">
        <div className="app-error-card">
          <div className="app-error-icon">
            <AlertTriangle size={28} />
          </div>

          <span className="app-error-eyebrow">FITCOACH AI</span>
          <h1>We hit a temporary display error</h1>

          <p>
            Your session is still safe. Refresh the page to retry the current
            screen, or return to your dashboard if the problem continues.
          </p>

          <div className="app-error-actions">
            <button type="button" onClick={this.handleReload}>
              <RefreshCw size={17} />
              Refresh Page
            </button>

            <button type="button" className="app-error-secondary" onClick={this.handleHome}>
              <ArrowLeft size={17} />
              Dashboard
            </button>
          </div>

          {import.meta.env.DEV && this.state.error?.message && (
            <details className="app-error-details">
              <summary>Technical details</summary>
              <code>{this.state.error.message}</code>
            </details>
          )}
        </div>
      </main>
    );
  }
}

export default AppErrorBoundary;
