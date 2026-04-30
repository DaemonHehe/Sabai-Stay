import { Component, type ErrorInfo, type ReactNode } from "react";
import { Layout } from "@/components/layout";
import { ErrorState } from "@/components/error-state";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled app error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Layout>
          <ErrorState
            code="500"
            title="Something broke"
            description={this.state.error.message || "The app hit an unexpected error while rendering this view."}
            actionLabel="Reload App"
            onAction={() => window.location.reload()}
            backHref="/"
          />
        </Layout>
      );
    }

    return this.props.children;
  }
}

