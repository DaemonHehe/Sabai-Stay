import { Layout } from "@/components/layout";
import { MapView } from "@/components/map-view";

export default function MapPage() {
  return (
    <Layout>
      <div className="fixed inset-0 top-20 z-0">
         <MapView />
      </div>
    </Layout>
  );
}