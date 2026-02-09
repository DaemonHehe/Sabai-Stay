import { Layout } from "@/components/layout";
import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SlidersHorizontal } from "lucide-react";

const filters = [
  { id: "ALL", label: "All" },
  { id: "CONDO", label: "Condo" },
  { id: "DORM", label: "Dorm" },
  { id: "LUXURY", label: "Luxury" },
  { id: "RESORT", label: "Resort" },
  { id: "LOFT", label: "Loft" },
  { id: "BUDGET", label: "Budget" },
];

export default function ListView() {
  const [activeFilter, setActiveFilter] = useState("ALL");
  
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: api.getListings,
  });

  const filteredListings = activeFilter === "ALL" 
    ? listings 
    : listings.filter(listing => listing.category === activeFilter);

  return (
    <Layout>
      <div className="container mx-auto px-4 md:px-6">
        
        {/* Hero Section */}
        <div className="mb-10 md:mb-14 relative">
          {/* Background Text */}
          <div className="absolute -top-8 right-0 text-[15vw] font-display font-bold opacity-[0.03] select-none pointer-events-none leading-none hidden lg:block">
            ROOMS
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-8 bg-primary"></div>
              <span className="font-mono text-xs text-primary uppercase tracking-widest">Student Housing</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold uppercase tracking-tighter mb-4 leading-[0.95]">
              Rangsit<br/>
              <span className="text-primary">Living</span>
            </h1>
            <p className="text-base md:text-lg opacity-50 font-light max-w-md leading-relaxed">
              Curated accommodations for university students. Find your perfect space to study, create, and thrive.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 md:gap-3 mb-8 overflow-x-auto no-scrollbar pb-2">
          <div className="flex items-center gap-2 pr-3 mr-1 border-r" style={{ borderColor: 'var(--color-border)' }}>
            <SlidersHorizontal className="h-4 w-4 opacity-40" />
            <span className="text-xs font-mono opacity-40 uppercase tracking-wider hidden sm:inline">Filter</span>
          </div>
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "text-xs font-mono tracking-wider px-4 py-2.5 rounded-full border transition-all whitespace-nowrap",
                activeFilter === filter.id 
                  ? "bg-primary border-primary text-primary-foreground font-bold" 
                  : "opacity-60 hover:opacity-100"
              )}
              style={activeFilter !== filter.id ? { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-secondary)' } : {}}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm opacity-40 font-mono">
            {isLoading ? "Loading..." : `${filteredListings.length} properties found`}
          </p>
        </div>
      
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Listings Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredListings.map((listing, index) => (
              <ListingCard 
                key={listing.id} 
                listing={listing} 
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredListings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-display font-bold mb-2">No rooms found</h3>
            <p className="opacity-50">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </Layout>
  );
}