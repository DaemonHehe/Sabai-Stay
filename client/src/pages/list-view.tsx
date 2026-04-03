import { Layout } from "@/components/layout";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "wouter";
import { api } from "@/lib/api";
import type { Listing } from "@shared/schema";

const categoryFilters = [
  "ALL",
  "CONDO",
  "DORM",
  "LUXURY",
  "RESORT",
  "LOFT",
  "CREATIVE",
  "BUDGET",
];

export default function ListView() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const { data: discovery } = useQuery({
    queryKey: ["discovery"],
    queryFn: api.getDiscovery,
  });
  const [category, setCategory] = useState("ALL");
  const [campusZoneId, setCampusZoneId] = useState("");
  const [roomType, setRoomType] = useState<Listing["roomType"] | "">("");
  const [maxWalkingMinutes, setMaxWalkingMinutes] = useState(30);
  const [minCapacity, setMinCapacity] = useState(1);
  const [maxPrice, setMaxPrice] = useState(25000);

  const filters = useMemo(
    () => ({
      q: searchQuery,
      category: category === "ALL" ? undefined : category,
      universityId: undefined,
      campusZoneId: campusZoneId || undefined,
      roomType: roomType || undefined,
      minCapacity,
      maxWalkingMinutes,
      maxPrice,
    }),
    [
      campusZoneId,
      category,
      maxPrice,
      maxWalkingMinutes,
      minCapacity,
      roomType,
      searchQuery,
    ],
  );

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings", filters],
    queryFn: () => api.getListings(filters),
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-10 md:mb-14 relative">
          <div className="absolute -top-8 right-0 text-[15vw] font-display font-bold opacity-[0.03] select-none pointer-events-none leading-none hidden lg:block">
            SEARCH
          </div>

          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-8 bg-primary" />
              <span className="font-mono text-xs text-primary uppercase tracking-widest">
                Student Housing Discovery
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold uppercase tracking-tighter mb-4 leading-[0.95]">
              Search
              <br />
              <span className="text-primary">By Campus Logic</span>
            </h1>
            <p className="text-base md:text-lg opacity-50 font-light max-w-2xl leading-relaxed">
              Filter by campus zone, room type, walking time, capacity, and monthly
              budget so the results match the housing decisions students actually make.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] mb-8">
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-2">
            <div
              className="flex items-center gap-2 pr-3 mr-1 border-r"
              style={{ borderColor: "var(--color-border)" }}
            >
              <SlidersHorizontal className="h-4 w-4 opacity-40" />
              <span className="text-xs font-mono opacity-40 uppercase tracking-wider hidden sm:inline">
                Filter
              </span>
            </div>
            {categoryFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => setCategory(filter)}
                className={`text-xs font-mono tracking-wider px-4 py-2.5 rounded-full border transition-all whitespace-nowrap ${
                  category === filter
                    ? "bg-primary border-primary text-primary-foreground font-bold"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={
                  category !== filter
                    ? {
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-secondary)",
                      }
                    : {}
                }
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              className="h-11 rounded-md border px-3 text-sm"
              style={{
                backgroundColor: "var(--color-secondary)",
                borderColor: "var(--color-border)",
              }}
              value={campusZoneId}
              onChange={(event) => setCampusZoneId(event.target.value)}
            >
              <option value="">All Campus Zones</option>
              {discovery?.campusZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-md border px-3 text-sm"
              style={{
                backgroundColor: "var(--color-secondary)",
                borderColor: "var(--color-border)",
              }}
              value={roomType}
              onChange={(event) =>
                setRoomType(event.target.value as Listing["roomType"] | "")
              }
            >
              <option value="">All Room Types</option>
              <option value="studio">studio</option>
              <option value="dorm">dorm</option>
              <option value="condo">condo</option>
              <option value="apartment">apartment</option>
              <option value="loft">loft</option>
              <option value="shared">shared</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 mb-8">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
              Max Walking Minutes
            </p>
            <input
              type="range"
              min={5}
              max={45}
              value={maxWalkingMinutes}
              onChange={(event) => setMaxWalkingMinutes(Number(event.target.value))}
              className="mt-3 w-full"
            />
            <p className="mt-2 text-sm opacity-60">{maxWalkingMinutes} minutes</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
              Minimum Capacity
            </p>
            <input
              type="range"
              min={1}
              max={4}
              value={minCapacity}
              onChange={(event) => setMinCapacity(Number(event.target.value))}
              className="mt-3 w-full"
            />
            <p className="mt-2 text-sm opacity-60">{minCapacity} guest(s)</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
              Max Monthly Budget
            </p>
            <input
              type="range"
              min={6000}
              max={30000}
              step={500}
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
              className="mt-3 w-full"
            />
            <p className="mt-2 text-sm opacity-60">฿{maxPrice.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm opacity-40 font-mono">
              {isLoading ? "Loading..." : `${listings.length} properties found`}
            </p>
            {searchQuery ? (
              <p className="text-xs font-mono opacity-50">Search: "{searchQuery}"</p>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, index) => (
              <ListingCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {!isLoading && listings.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-xs font-mono tracking-[0.3em] text-primary mb-4">
              NO MATCHES
            </div>
            <h3 className="text-xl font-display font-bold mb-2">No rooms found</h3>
            <p className="opacity-50">
              Relax the campus or budget filters to broaden the discovery set.
            </p>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
