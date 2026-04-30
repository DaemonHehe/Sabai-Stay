import { Layout } from "@/components/layout";
import { ErrorState } from "@/components/error-state";

export default function ServerError() {
  return (
    <Layout>
      <ErrorState
        code="500"
        title="Service unavailable"
        description="The app could not complete the request. Try again, or return to the map while the service recovers."
        actionLabel="Reload"
        onAction={() => window.location.reload()}
        backHref="/"
      />
    </Layout>
  );
}

