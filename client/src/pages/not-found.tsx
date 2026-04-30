import { Layout } from "@/components/layout";
import { ErrorState } from "@/components/error-state";

export default function NotFound() {
  return (
    <Layout>
      <ErrorState
        code="404"
        title="Page not found"
        description="This page does not exist or the link is no longer active."
        backHref="/"
      />
    </Layout>
  );
}
