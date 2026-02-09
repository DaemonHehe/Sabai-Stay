import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Circle } from 'react-leaflet';
import { divIcon, LatLngExpression } from 'leaflet';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Star, MapPin, GraduationCap } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';

import 'leaflet/dist/leaflet.css';

const RSU_COORDS: LatLngExpression = [13.9649, 100.5878];

const createCustomIcon = (price: number, isDark: boolean) => {
  const bgColor = isDark ? 'black' : 'white';
  const textColor = isDark ? '#c8ff00' : '#5a8f00';
  const borderColor = isDark ? '#c8ff00' : '#5a8f00';
  
  return divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative group">
        <div style="background: ${bgColor}; color: ${textColor}; border: 2px solid ${borderColor}; font-family: monospace; font-weight: bold; padding: 4px 12px; font-size: 11px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-radius: 2px;">
          ฿${price.toLocaleString()}
        </div>
        <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; background: ${bgColor}; border-bottom: 2px solid ${borderColor}; border-right: 2px solid ${borderColor}; transform: translateX(-50%) rotate(45deg);"></div>
      </div>
    `,
    iconSize: [80, 40],
    iconAnchor: [40, 45]
  });
};

const createUniversityIcon = (isDark: boolean) => {
  const bgColor = isDark ? '#c8ff00' : '#5a8f00';
  
  return divIcon({
    className: 'university-marker',
    html: `
      <div style="background: ${bgColor}; padding: 8px; border-radius: 50%; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${isDark ? 'black' : 'white'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

export function MapView({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: api.getListings,
  });

  const tileUrl = isDark 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div className={`h-full w-full relative z-0 ${className}`}>
      {/* @ts-ignore - Leaflet types mismatch */}
      <MapContainer 
        center={RSU_COORDS}
        zoom={14} 
        scrollWheelZoom={true} 
        className="h-full w-full outline-none"
        zoomControl={false}
        key={resolvedTheme}
      >
        {/* @ts-ignore */}
        <ZoomControl position="bottomright" />
        
        {/* @ts-ignore - Leaflet types mismatch */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
        />
        
        {/* University Area Circle */}
        {/* @ts-ignore */}
        <Circle 
          center={RSU_COORDS}
          radius={800}
          pathOptions={{
            color: isDark ? '#c8ff00' : '#5a8f00',
            fillColor: isDark ? '#c8ff00' : '#5a8f00',
            fillOpacity: 0.08,
            weight: 1,
            dashArray: '5, 10'
          }}
        />
        
        {/* University Marker */}
        {/* @ts-ignore */}
        <Marker 
          position={RSU_COORDS}
          icon={createUniversityIcon(isDark)}
        >
          {/* @ts-ignore */}
          <Popup className="custom-popup" closeButton={false}>
            <div className="p-3 text-center" style={{ background: isDark ? 'hsl(220 15% 10%)' : 'white', color: isDark ? 'white' : 'black' }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span className="font-display font-bold text-sm">Rangsit University</span>
              </div>
              <p className="text-xs opacity-60">Main Campus</p>
            </div>
          </Popup>
        </Marker>
        
        {listings.map((listing) => (
          // @ts-ignore - Leaflet types mismatch
          <Marker 
            key={listing.id} 
            position={[parseFloat(listing.latitude), parseFloat(listing.longitude)]} 
            icon={createCustomIcon(listing.price, isDark)}
          >
            {/* @ts-ignore - Leaflet types mismatch */}
            <Popup className="custom-popup" closeButton={false}>
              <Link href={`/listing/${listing.id}`}>
                <div className="w-72 cursor-pointer group" style={{ background: isDark ? 'hsl(220 15% 10%)' : 'white' }}>
                  <div className="aspect-[16/10] w-full overflow-hidden">
                    <img 
                      src={listing.image} 
                      alt={listing.title} 
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4" style={{ color: isDark ? 'white' : 'black' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: isDark ? '#c8ff00' : '#5a8f00' }}>{listing.category}</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" style={{ fill: isDark ? '#c8ff00' : '#5a8f00', color: isDark ? '#c8ff00' : '#5a8f00' }} />
                        <span className="text-xs font-mono">{listing.rating}</span>
                      </div>
                    </div>
                    <h3 className="font-display font-bold text-base mb-1 transition-colors" style={{ color: isDark ? 'white' : 'black' }}>{listing.title}</h3>
                    <div className="flex items-center gap-1 opacity-50 text-xs mb-3">
                      <MapPin className="h-3 w-3" />
                      <span>{listing.location}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      <div>
                        <span className="font-display font-bold text-lg" style={{ color: isDark ? '#c8ff00' : '#5a8f00' }}>฿{listing.price.toLocaleString()}</span>
                        <span className="opacity-40 text-xs font-mono">/month</span>
                      </div>
                      <span className="text-xs font-mono opacity-40 transition-colors">View →</span>
                    </div>
                  </div>
                </div>
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000]" style={{ backgroundColor: 'var(--color-background)', opacity: 0.9 }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          </div>
        </div>
      )}
    </div>
  );
}