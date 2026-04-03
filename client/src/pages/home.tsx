import { lazy, Suspense } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSearchParams } from "wouter";
import { filterListingsByQuery } from "@/lib/listing-search";

const MapView = lazy(() =>
  import("@/components/map-view").then((module) => ({
    default: module.MapView,
  })),
);

export default function Home() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings", searchQuery],
    queryFn: () => api.getListings({ q: searchQuery }),
  });
  const { data: discovery } = useQuery({
    queryKey: ["discovery"],
    queryFn: api.getDiscovery,
  });

  const filteredListings = filterListingsByQuery(listings, searchQuery);
  const totalListings = filteredListings.length;
  const avgPrice =
    filteredListings.length > 0
      ? Math.round(
          filteredListings.reduce((acc, listing) => acc + listing.price, 0) /
            filteredListings.length,
        )
      : 0;

  return (
    <Layout noPadding>
      <div className="h-screen w-full relative">
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
              </div>
            </div>
          }
        >
          <MapView searchQuery={searchQuery} />
        </Suspense>

        <div className="absolute top-24 left-4 md:left-6 z-[1000] max-w-sm pointer-events-auto">
          <div
            className="backdrop-blur-xl border p-5 md:p-6 space-y-4 rounded-sm"
            style={{
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold leading-tight">
                Find Your
                <br />
                <span className="text-primary">Student Room</span>
              </h1>
              <p className="opacity-50 text-sm mt-2 font-light">
                {discovery?.campusZones.length ?? 0} campus zones ·{" "}
                {discovery?.transportRoutes.length ?? 0} transport routes
              </p>
            </div>

            <div
              className="grid grid-cols-2 gap-3 pt-2 border-t"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="space-y-0.5">
                <div className="text-2xl font-display font-bold">
                  {totalListings}
                </div>
                <div className="text-[10px] font-mono opacity-40 uppercase tracking-wider">
                  Properties
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-display font-bold text-primary">
                  {"\u0E3F"}
                  {avgPrice.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono opacity-40 uppercase tracking-wider">
                  Avg/Month
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-sm">
            <p
              className="text-xs font-mono"
              style={{ color: "var(--color-primary)" }}
            >
              <span className="font-bold">TIP:</span>{" "}
              {searchQuery
                ? "Results are filtered by your search"
                : "Click markers to preview rooms"}
            </p>
          </div>
        </div>

        <div className="absolute bottom-24 md:bottom-8 right-4 md:right-6 z-[1000] hidden md:block">
          <div
            className="backdrop-blur-sm border px-3 py-2 text-[10px] font-mono opacity-40 uppercase tracking-wider rounded-sm"
            style={{
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-border)",
            }}
          >
            Scroll to zoom
          </div>
        </div>
      </div>
    </Layout>
  );
}
