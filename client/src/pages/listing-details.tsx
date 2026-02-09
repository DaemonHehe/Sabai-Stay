import { Layout } from "@/components/layout";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, MapPin, ArrowLeft, Wifi, Car, Coffee, Tv, Bath, Wind, CheckCircle2, GraduationCap } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import NotFound from "./not-found";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const amenities = [
  { icon: Wifi, label: "High-Speed WiFi" },
  { icon: Car, label: "Parking" },
  { icon: Coffee, label: "Kitchen" },
  { icon: Tv, label: "Smart TV" },
  { icon: Bath, label: "Private Bath" },
  { icon: Wind, label: "Air Conditioning" },
];

export default function ListingDetails() {
  const [match, params] = useRoute("/listing/:id");
  const { toast } = useToast();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingData, setBookingData] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    guests: 1,
  });

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', params?.id],
    queryFn: () => api.getListing(params!.id),
    enabled: !!params?.id,
  });

  const bookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => {
      toast({
        title: "Booking Confirmed!",
        description: "We'll send you a confirmation email shortly.",
      });
      setIsBookingOpen(false);
      setBookingData({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkIn: "",
        checkOut: "",
        guests: 1,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBooking = () => {
    if (!listing) return;
    if (!bookingData.guestName || !bookingData.guestEmail || !bookingData.guestPhone || !bookingData.checkIn || !bookingData.checkOut) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    bookingMutation.mutate({
      listingId: listing.id,
      guestName: bookingData.guestName,
      guestEmail: bookingData.guestEmail,
      guestPhone: bookingData.guestPhone,
      checkIn: new Date(bookingData.checkIn),
      checkOut: new Date(bookingData.checkOut),
      guests: bookingData.guests,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!listing) return <NotFound />;

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Back Button */}
        <div className="container mx-auto px-4 md:px-6 mb-6">
          <Link href="/list">
            <button className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity text-sm font-mono">
              <ArrowLeft className="h-4 w-4" />
              Back to listings
            </button>
          </Link>
        </div>

        {/* Hero Image */}
        <div className="h-[50vh] md:h-[60vh] w-full relative overflow-hidden">
          <img src={listing.image} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          
          {/* Category Badge */}
          <div className="absolute top-6 left-6">
            <div className="bg-primary text-primary-foreground font-mono text-xs font-bold px-3 py-1.5 uppercase tracking-wider">
              {listing.category}
            </div>
          </div>
          
          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
            <div className="container mx-auto">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 text-white/60 text-sm mb-3">
                  <MapPin className="h-4 w-4" />
                  <span>{listing.location}</span>
                  <span className="px-2">•</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span>{listing.rating}</span>
                  </div>
                </div>
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight">
                  {listing.title}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 md:px-6 py-10 md:py-16">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16">
            
            {/* Main Content */}
            <div className="lg:col-span-7 space-y-10">
              
              {/* Distance to University */}
              <div className="flex items-center gap-3 p-4 rounded-sm border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="p-2 bg-primary/20 rounded-full">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold">Near Rangsit University</p>
                  <p className="text-sm opacity-60">Approx. 5-15 min walk to campus</p>
                </div>
              </div>
              
              {/* Description */}
              <div>
                <h2 className="text-lg font-display font-bold uppercase mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary"></div>
                  About This Place
                </h2>
                <p className="opacity-70 leading-relaxed text-base">
                  {listing.description}
                </p>
              </div>

              {/* Amenities */}
              <div>
                <h2 className="text-lg font-display font-bold uppercase mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary"></div>
                  Amenities
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {amenities.map((amenity, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-sm border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
                      <amenity.icon className="h-5 w-5 text-primary" />
                      <span className="text-sm opacity-80">{amenity.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gallery */}
              <div>
                <h2 className="text-lg font-display font-bold uppercase mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary"></div>
                  Gallery
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <img src="/images/condo-pool.png" className="aspect-square object-cover rounded-sm hover:opacity-80 transition-opacity cursor-pointer" />
                  <img src="/images/co-working.png" className="aspect-square object-cover rounded-sm hover:opacity-80 transition-opacity cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Booking Sidebar */}
            <div className="lg:col-span-5">
              <div className="sticky top-28 p-6 md:p-8 border backdrop-blur-sm rounded-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-end justify-between mb-6 pb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <div className="text-3xl md:text-4xl font-display font-bold text-primary">฿{listing.price.toLocaleString()}</div>
                    <div className="font-mono text-xs opacity-40 mt-1">PER MONTH</div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }}>
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="text-sm font-mono">{listing.rating}</span>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-sm text-center" style={{ backgroundColor: 'var(--color-secondary)' }}>
                    <div className="text-xl font-display font-bold">1</div>
                    <div className="text-[10px] font-mono opacity-40 uppercase">Bedroom</div>
                  </div>
                  <div className="p-3 rounded-sm text-center" style={{ backgroundColor: 'var(--color-secondary)' }}>
                    <div className="text-xl font-display font-bold">2</div>
                    <div className="text-[10px] font-mono opacity-40 uppercase">Max Guests</div>
                  </div>
                </div>

                <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full h-14 bg-primary text-primary-foreground font-display font-bold text-base uppercase tracking-widest hover:opacity-90 transition-opacity rounded-sm" data-testid="button-reserve">
                      Reserve Now
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border max-w-md" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                    <DialogHeader>
                      <DialogTitle className="font-display text-2xl uppercase">Book Your Room</DialogTitle>
                      <DialogDescription className="opacity-60">
                        Complete your reservation for {listing.title}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="name" className="opacity-80 text-sm">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="Enter your name"
                          value={bookingData.guestName}
                          onChange={(e) => setBookingData({ ...bookingData, guestName: e.target.value })}
                          className="border mt-1.5 h-11"
                          style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}
                          data-testid="input-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="opacity-80 text-sm">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={bookingData.guestEmail}
                          onChange={(e) => setBookingData({ ...bookingData, guestEmail: e.target.value })}
                          className="border mt-1.5 h-11"
                          style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}
                          data-testid="input-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="opacity-80 text-sm">Phone Number</Label>
                        <Input
                          id="phone"
                          placeholder="+66 XX XXX XXXX"
                          value={bookingData.guestPhone}
                          onChange={(e) => setBookingData({ ...bookingData, guestPhone: e.target.value })}
                          className="border mt-1.5 h-11"
                          style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}
                          data-testid="input-phone"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="checkIn" className="opacity-80 text-sm">Move In</Label>
                          <Input
                            id="checkIn"
                            type="date"
                            value={bookingData.checkIn}
                            onChange={(e) => setBookingData({ ...bookingData, checkIn: e.target.value })}
                            className="border mt-1.5 h-11"
                            style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}
                            data-testid="input-checkin"
                          />
                        </div>
                        <div>
                          <Label htmlFor="checkOut" className="opacity-80 text-sm">Move Out</Label>
                          <Input
                            id="checkOut"
                            type="date"
                            value={bookingData.checkOut}
                            onChange={(e) => setBookingData({ ...bookingData, checkOut: e.target.value })}
                            className="border mt-1.5 h-11"
                            style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}
                            data-testid="input-checkout"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleBooking}
                        disabled={bookingMutation.isPending}
                        className="w-full h-12 bg-primary text-primary-foreground hover:opacity-90 font-display font-bold uppercase tracking-widest rounded-sm mt-2"
                        data-testid="button-confirm-booking"
                      >
                        {bookingMutation.isPending ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                            Processing...
                          </span>
                        ) : (
                          "Confirm Booking"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <p className="text-center text-xs opacity-40 mt-4 font-mono">
                  No payment required now
                </p>

                {/* Highlights */}
                <div className="mt-6 pt-6 border-t space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="opacity-70">Instant confirmation</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="opacity-70">Free cancellation within 48hrs</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="opacity-70">24/7 support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
