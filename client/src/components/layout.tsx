import { Search, User, Map as MapIcon, List, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Layout({ children, noPadding = false }: { children: React.ReactNode, noPadding?: boolean }) {
  const [location] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--color-background), var(--color-background) 60%, transparent)' }} />
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/">
            <div className="cursor-pointer group flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <span className="font-display font-black text-primary-foreground text-lg">R</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-bold text-xl tracking-tighter group-hover:text-primary transition-colors">ROAM</span>
                <span className="text-[9px] font-mono block tracking-[0.3em] opacity-40 -mt-0.5">RANGSIT</span>
              </div>
            </div>
          </Link>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-secondary/50 backdrop-blur-md px-2 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)' }}>
             <Link href="/">
               <button className={cn(
                 "px-5 py-2 rounded-full font-mono text-xs tracking-wider transition-all",
                 location === "/" ? "bg-primary text-primary-foreground font-bold" : "opacity-70 hover:opacity-100 hover:bg-secondary"
               )}>
                 MAP
               </button>
             </Link>
             <Link href="/list">
               <button className={cn(
                 "px-5 py-2 rounded-full font-mono text-xs tracking-wider transition-all",
                 location === "/list" ? "bg-primary text-primary-foreground font-bold" : "opacity-70 hover:opacity-100 hover:bg-secondary"
               )}>
                 LIST
               </button>
             </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Search Toggle */}
            <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className="h-10 w-10 rounded-full bg-secondary/50 border flex items-center justify-center hover:bg-secondary transition-colors"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="md:hidden h-10 w-10 rounded-full bg-secondary/50 border flex items-center justify-center hover:bg-secondary transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="border-l w-[280px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                <nav className="flex flex-col gap-4 mt-8">
                  <Link href="/">
                    <div className={cn(
                      "px-4 py-3 font-display text-xl uppercase tracking-wide border-l-2 transition-all",
                      location === "/" ? "border-primary text-primary" : "border-transparent opacity-60 hover:opacity-100"
                    )}>
                      Map View
                    </div>
                  </Link>
                  <Link href="/list">
                    <div className={cn(
                      "px-4 py-3 font-display text-xl uppercase tracking-wide border-l-2 transition-all",
                      location === "/list" ? "border-primary text-primary" : "border-transparent opacity-60 hover:opacity-100"
                    )}>
                      All Rooms
                    </div>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>

            {/* User Avatar */}
            <div className="hidden sm:flex h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 items-center justify-center cursor-pointer hover:border-primary transition-colors">
              <User className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
        
        {/* Search Bar Dropdown */}
        <div className={cn(
          "container mx-auto px-4 md:px-6 overflow-hidden transition-all duration-300",
          searchOpen ? "max-h-20 opacity-100 pb-4" : "max-h-0 opacity-0"
        )}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
            <Input 
              placeholder="Search condos, dorms, locations..." 
              className="w-full bg-secondary/50 border pl-12 h-12 focus:border-primary"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
        </div>
      </header>

      <main className={cn("min-h-screen page-enter", noPadding ? "pt-0 pb-0" : "pt-28 pb-12")}>
        {children}
      </main>

      {/* Floating Toggle */}
      {location !== "/listing" && !location.includes("/listing/") && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:hidden">
          <Link href={location === "/" ? "/list" : "/"}>
            <Button 
              className="rounded-full h-14 px-8 bg-primary text-primary-foreground hover:opacity-90 font-display font-bold tracking-wider text-xs uppercase shadow-lg shadow-primary/20 transition-all"
            >
              {location === "/" ? (
                <>
                  <List className="mr-2 h-4 w-4" /> View List
                </>
              ) : (
                <>
                  <MapIcon className="mr-2 h-4 w-4" /> View Map
                </>
              )}
            </Button>
          </Link>
        </div>
      )}

      {/* Footer */}
      {!noPadding && (
        <footer className="border-t py-16" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
           <div className="container mx-auto px-4 md:px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                 <div className="col-span-2 md:col-span-1 space-y-4">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-primary flex items-center justify-center">
                       <span className="font-display font-black text-primary-foreground text-sm">R</span>
                     </div>
                     <span className="font-display font-bold text-lg">ROAM</span>
                   </div>
                   <p className="opacity-40 text-sm max-w-xs leading-relaxed">Student housing platform for Rangsit University and Bangkok universities.</p>
                 </div>
                 
                 <div className="space-y-4">
                   <h4 className="font-mono text-xs text-primary uppercase tracking-wider">Explore</h4>
                   <ul className="space-y-2 text-sm opacity-50">
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">All Rooms</li>
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">Map View</li>
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">Near RSU</li>
                   </ul>
                 </div>
  
                 <div className="space-y-4">
                   <h4 className="font-mono text-xs text-primary uppercase tracking-wider">Support</h4>
                   <ul className="space-y-2 text-sm opacity-50">
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">Help Center</li>
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">Contact</li>
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">FAQ</li>
                   </ul>
                 </div>
  
                 <div className="space-y-4">
                   <h4 className="font-mono text-xs text-primary uppercase tracking-wider">Legal</h4>
                   <ul className="space-y-2 text-sm opacity-50">
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">Privacy</li>
                     <li className="hover:opacity-100 cursor-pointer transition-opacity">Terms</li>
                   </ul>
                 </div>
              </div>
              <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-xs opacity-30 font-mono" style={{ borderColor: 'var(--color-border)' }}>
                 <p>© 2026 ROAM RANGSIT</p>
                 <p className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                   PATHUM THANI, THAILAND
                 </p>
              </div>
           </div>
        </footer>
      )}
    </div>
  );
}