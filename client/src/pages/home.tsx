import { Layout } from "@/components/layout";
import { MapView } from "@/components/map-view";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function Home() {
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: api.getListings,
  });

  const totalListings = listings.length;
  const avgPrice = listings.length > 0 
    ? Math.round(listings.reduce((acc, l) => acc + l.price, 0) / listings.length)
    : 0;

  return (
    <Layout noPadding>
      <div className="h-screen w-full relative">
        <MapView />
        
        {/* Floating Stats Panel */}
        <div className="absolute top-24 left-4 md:left-6 z-[1000] max-w-sm pointer-events-auto">
          <div className="backdrop-blur-xl border p-5 md:p-6 space-y-4 rounded-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold leading-tight">
                Find Your<br/>
                <span className="text-primary">Student Room</span>
              </h1>
              <p className="opacity-50 text-sm mt-2 font-light">Near Rangsit University</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="space-y-0.5">
                <div className="text-2xl font-display font-bold">{totalListings}</div>
                <div className="text-[10px] font-mono opacity-40 uppercase tracking-wider">Properties</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-display font-bold text-primary">฿{avgPrice.toLocaleString()}</div>
                <div className="text-[10px] font-mono opacity-40 uppercase tracking-wider">Avg/Month</div>
              </div>
            </div>
          </div>
          
          {/* Quick Tips */}
          <div className="mt-3 bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-sm">
            <p className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>
              <span className="font-bold">TIP:</span> Click markers to preview rooms
            </p>
          </div>
        </div>

        {/* Zoom Indicator */}
        <div className="absolute bottom-24 md:bottom-8 right-4 md:right-6 z-[1000] hidden md:block">
          <div className="backdrop-blur-sm border px-3 py-2 text-[10px] font-mono opacity-40 uppercase tracking-wider rounded-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            Scroll to zoom
          </div>
        </div>
      </div>
    </Layout>
  );
}