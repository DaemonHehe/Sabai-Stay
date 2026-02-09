import { Link } from "wouter";
import { ArrowUpRight, Star, MapPin } from "lucide-react";
import type { Listing } from "@shared/schema";

interface ListingCardProps {
  listing: Listing;
  featured?: boolean;
}

export function ListingCard({ listing, featured = false }: ListingCardProps) {
  return (
    <Link href={`/listing/${listing.id}`}>
      <div className={`group cursor-pointer relative card-hover ${featured ? 'md:col-span-2 md:row-span-2' : ''}`}>
        
        {/* Image Container */}
        <div className="relative aspect-[3/4] md:aspect-[4/5] overflow-hidden w-full h-full rounded-sm" style={{ backgroundColor: 'var(--color-card)' }}>
          <img
            src={listing.image}
            alt={listing.title}
            className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110 saturate-[0.9] group-hover:saturate-100"
          />
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90 group-hover:opacity-70 transition-opacity duration-500" />

          {/* Top Tags */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            <div className="bg-primary text-primary-foreground font-mono text-[10px] font-bold px-2.5 py-1.5 uppercase tracking-wider">
              {listing.category}
            </div>
            <div className="bg-black/60 backdrop-blur-sm text-white font-mono text-xs font-bold px-3 py-1.5 flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-primary text-primary" />
              {listing.rating}
            </div>
          </div>
          
          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-white/60 text-xs font-mono">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{listing.location}</span>
              </div>
              <h3 className={`font-display font-bold leading-tight text-white ${featured ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'}`}>
                {listing.title}
              </h3>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-baseline gap-1">
                  <span className="text-primary font-display font-bold text-xl">฿{listing.price.toLocaleString()}</span>
                  <span className="text-white/40 text-xs font-mono">/mo</span>
                </div>
                <div className="w-8 h-8 bg-white/10 group-hover:bg-primary flex items-center justify-center transition-all duration-300 rounded-sm">
                  <ArrowUpRight className="h-4 w-4 text-white group-hover:text-black transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="relative aspect-[3/4] md:aspect-[4/5] overflow-hidden rounded-sm animate-pulse" style={{ backgroundColor: 'var(--color-secondary)' }}>
      <div className="absolute top-3 left-3 w-16 h-6 rounded" style={{ backgroundColor: 'var(--color-muted)' }}></div>
      <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
        <div className="w-24 h-3 rounded" style={{ backgroundColor: 'var(--color-muted)' }}></div>
        <div className="w-full h-6 rounded" style={{ backgroundColor: 'var(--color-muted)' }}></div>
        <div className="w-20 h-5 rounded" style={{ backgroundColor: 'var(--color-muted)' }}></div>
      </div>
    </div>
  );
}