import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  CircleAlert,
  MapPin,
  Star,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import NotFound from "./not-found";

function BookingModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg rounded-sm border p-6"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ListingDetails() {
  const [, params] = useRoute("/listing/:id");
  const { toast } = useToast();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [utilityUsage, setUtilityUsage] = useState({
    electricityUsageUnits: 120,
    waterUsageUnits: 12,
  });
  const [bookingData, setBookingData] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    guests: 1,
    requestNote: "",
  });
  const [reviewData, setReviewData] = useState({
    studentUserId: "student-001",
    studentName: "Current Student",
    rating: 5,
    comment: "",
  });
  const [ownerResponseDraft, setOwnerResponseDraft] = useState<Record<string, string>>({});

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", params?.id],
    queryFn: () => api.getListing(params!.id),
    enabled: Boolean(params?.id),
  });
  const { data: discovery } = useQuery({
    queryKey: ["discovery"],
    queryFn: api.getDiscovery,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", params?.id],
    queryFn: () => api.getReviews(params!.id),
    enabled: Boolean(params?.id),
  });
  const { data: utilityEstimate } = useQuery({
    queryKey: ["utility-estimate", params?.id, utilityUsage],
    queryFn: () =>
      api.estimateUtilities(
        params!.id,
        utilityUsage.electricityUsageUnits,
        utilityUsage.waterUsageUnits,
      ),
    enabled: Boolean(params?.id),
  });

  const bookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Booking request submitted",
        description:
          "The request now enters the owner approval and deposit workflow.",
      });
      setIsBookingOpen(false);
      setBookingData({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkIn: "",
        checkOut: "",
        guests: 1,
        requestNote: "",
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: api.createReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Review submitted",
        description: "Reviews and owner responses are now part of the listing trust flow.",
      });
      setReviewData((current) => ({ ...current, comment: "", rating: 5 }));
    },
  });

  const reviewResponseMutation = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      api.respondToReview(id, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", params?.id] });
      toast({
        title: "Owner response saved",
        description: "The review thread now includes the landlord reply.",
      });
    },
  });

  const zone = useMemo(
    () =>
      discovery?.campusZones.find(
        (item) => item.id === listing?.nearestCampusZoneId,
      ) ?? null,
    [discovery?.campusZones, listing?.nearestCampusZoneId],
  );
  const routes = useMemo(
    () =>
      discovery?.transportRoutes.filter((route) =>
        listing?.transportRouteIds.includes(route.id),
      ) ?? [],
    [discovery?.transportRoutes, listing?.transportRouteIds],
  );

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
        ).toFixed(1)
      : listing?.rating ?? "0.0";

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!listing) {
    return <NotFound />;
  }

  return (
    <Layout>
      <div className="min-h-screen">
        <div className="container mx-auto px-4 md:px-6 mb-6">
          <Link href="/list">
            <button className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity text-sm font-mono">
              <ArrowLeft className="h-4 w-4" />
              Back to listings
            </button>
          </Link>
        </div>

        <div className="h-[50vh] md:h-[60vh] w-full relative overflow-hidden">
          <img
            src={listing.image}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
            <div className="container mx-auto">
              <div className="max-w-4xl">
                <div className="flex items-center gap-3 text-white/60 text-sm mb-3">
                  <MapPin className="h-4 w-4" />
                  <span>{listing.location}</span>
                  <span className="px-2">•</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span>{averageRating}</span>
                  </div>
                </div>
                <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight">
                  {listing.title}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="bg-primary text-primary-foreground px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                    {listing.category}
                  </span>
                  <span className="bg-black/50 text-white px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                    {listing.roomType}
                  </span>
                  <span className="bg-black/50 text-white px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                    {listing.walkingMinutes} min walk
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-10 md:py-16">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16">
            <div className="lg:col-span-7 space-y-10">
              <div
                className="flex items-center gap-3 p-4 rounded-sm border"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="p-2 bg-primary/20 rounded-full shrink-0">
                  <CircleAlert className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold">Transparent Listing Data</p>
                  <p className="text-sm opacity-60">
                    This listing now exposes utility rates, lease options, campus-zone proximity, and transport routes instead of fabricated details.
                  </p>
                </div>
              </div>

              <section>
                <h2 className="text-lg font-display font-bold uppercase mb-4">
                  About This Place
                </h2>
                <p className="opacity-70 leading-relaxed text-base">
                  {listing.description}
                </p>
              </section>

              <section>
                <h2 className="text-lg font-display font-bold uppercase mb-4">
                  Amenities And Lease Terms
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div
                    className="rounded-sm border p-5"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <p className="font-display font-bold">Amenities</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {listing.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-wider"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="rounded-sm border p-5"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <p className="font-display font-bold">Lease Options</p>
                    <div className="mt-3 space-y-2 text-sm opacity-70">
                      {listing.leaseOptions.map((option) => (
                        <p key={option.months}>
                          {option.label} · {option.months} month(s)
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-display font-bold uppercase mb-4">
                  Campus Navigation
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div
                    className="rounded-sm border p-5"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <p className="font-display font-bold">Nearest Campus Zone</p>
                    <p className="mt-3 text-lg">{zone?.name ?? "Campus zone unavailable"}</p>
                    <p className="mt-2 text-sm opacity-70">
                      {zone?.description ?? "No zone description is available for this listing."}
                    </p>
                    <p className="mt-2 text-sm font-mono opacity-60">
                      Approx. {listing.walkingMinutes} minutes on foot
                    </p>
                  </div>
                  <div
                    className="rounded-sm border p-5"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <p className="font-display font-bold">Transport Routes</p>
                    <div className="mt-3 space-y-3">
                      {routes.map((route) => (
                        <div key={route.id} className="flex items-start gap-3 text-sm">
                          <Bus className="h-4 w-4 text-primary mt-0.5" />
                          <div>
                            <p className="font-semibold">{route.name}</p>
                            <p className="opacity-60">{route.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-display font-bold uppercase mb-4">
                  Reviews
                </h2>
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-sm border p-5"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{review.studentName}</p>
                          <p className="text-sm opacity-60">{review.rating}/5</p>
                        </div>
                        <p className="text-xs font-mono opacity-40">
                          {review.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <p className="mt-3 text-sm opacity-80">{review.comment}</p>
                      {review.ownerResponse ? (
                        <div
                          className="mt-4 rounded-sm border p-3 text-sm"
                          style={{ borderColor: "var(--color-border)" }}
                        >
                          <p className="font-semibold">Owner response</p>
                          <p className="mt-2 opacity-70">{review.ownerResponse}</p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            placeholder="Write an owner response"
                            value={ownerResponseDraft[review.id] ?? ""}
                            onChange={(event) =>
                              setOwnerResponseDraft((current) => ({
                                ...current,
                                [review.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              reviewResponseMutation.mutate({
                                id: review.id,
                                response: ownerResponseDraft[review.id] ?? "",
                              })
                            }
                            disabled={!ownerResponseDraft[review.id]?.trim()}
                          >
                            Post Owner Response
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  className="mt-6 rounded-sm border p-5"
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <p className="font-display font-bold uppercase">Leave a review</p>
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={reviewData.studentName}
                        onChange={(event) =>
                          setReviewData((current) => ({
                            ...current,
                            studentName: event.target.value,
                          }))
                        }
                      />
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={reviewData.rating}
                        onChange={(event) =>
                          setReviewData((current) => ({
                            ...current,
                            rating: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <Textarea
                      placeholder="Share your stay experience"
                      value={reviewData.comment}
                      onChange={(event) =>
                        setReviewData((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                    />
                    <Button
                      onClick={() =>
                        reviewMutation.mutate({
                          listingId: listing.id,
                          studentUserId: reviewData.studentUserId,
                          studentName: reviewData.studentName,
                          rating: reviewData.rating,
                          comment: reviewData.comment,
                        })
                      }
                      disabled={!reviewData.comment.trim()}
                    >
                      Submit Review
                    </Button>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-28 space-y-6">
                <div
                  className="p-6 md:p-8 border backdrop-blur-sm rounded-sm"
                  style={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div
                    className="flex items-end justify-between mb-6 pb-6 border-b"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <div>
                      <div className="text-3xl md:text-4xl font-display font-bold text-primary">
                        ฿{listing.price.toLocaleString()}
                      </div>
                      <div className="font-mono text-xs opacity-40 mt-1">PER MONTH</div>
                    </div>
                    <div className="text-right text-sm opacity-60">
                      <p>{listing.capacity} guests</p>
                      <p>{listing.areaSqm} sqm</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => setIsBookingOpen(true)}
                    className="w-full h-14 bg-primary text-primary-foreground font-display font-bold text-base uppercase tracking-widest hover:opacity-90 transition-opacity rounded-sm"
                  >
                    Request Booking
                  </Button>

                  <p className="mt-4 text-center text-xs opacity-40 font-mono">
                    Workflow: Request → Approval → Deposit → Confirmed
                  </p>
                </div>

                <div
                  className="rounded-sm border p-6"
                  style={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display font-bold uppercase">
                        Utility Calculator
                      </p>
                      <p className="mt-1 text-sm opacity-60">
                        Estimate the real monthly total before you commit.
                      </p>
                    </div>
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Input
                      type="number"
                      value={utilityUsage.electricityUsageUnits}
                      onChange={(event) =>
                        setUtilityUsage((current) => ({
                          ...current,
                          electricityUsageUnits: Number(event.target.value),
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={utilityUsage.waterUsageUnits}
                      onChange={(event) =>
                        setUtilityUsage((current) => ({
                          ...current,
                          waterUsageUnits: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="mt-4 space-y-2 text-sm opacity-70">
                    <p>
                      Electricity rate: ฿{listing.utilityRates.electricityPerUnit}/unit
                    </p>
                    <p>Water rate: ฿{listing.utilityRates.waterPerUnit}/unit</p>
                    <p>
                      Internet:{" "}
                      {listing.internetIncluded
                        ? "Included"
                        : `฿${listing.utilityRates.internetFee}`}
                    </p>
                    <p>Service fee: ฿{listing.utilityRates.serviceFee}</p>
                  </div>
                  {utilityEstimate ? (
                    <div
                      className="mt-4 rounded-sm border p-4"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <p className="text-sm opacity-60">Estimated Monthly Utilities</p>
                      <p className="mt-2 font-display text-3xl font-bold text-primary">
                        ฿{utilityEstimate.total.toLocaleString()}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BookingModal open={isBookingOpen} onClose={() => setIsBookingOpen(false)}>
        <div className="space-y-4">
          <div>
            <p className="font-display text-2xl font-bold uppercase">
              Booking Request
            </p>
            <p className="mt-2 text-sm opacity-60">
              Your request starts the approval, deposit, and contract workflow.
            </p>
          </div>
          <Input
            placeholder="Full Name"
            value={bookingData.guestName}
            onChange={(event) =>
              setBookingData((current) => ({
                ...current,
                guestName: event.target.value,
              }))
            }
          />
          <Input
            placeholder="Email"
            value={bookingData.guestEmail}
            onChange={(event) =>
              setBookingData((current) => ({
                ...current,
                guestEmail: event.target.value,
              }))
            }
          />
          <Input
            placeholder="Phone"
            value={bookingData.guestPhone}
            onChange={(event) =>
              setBookingData((current) => ({
                ...current,
                guestPhone: event.target.value,
              }))
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="date"
              value={bookingData.checkIn}
              onChange={(event) =>
                setBookingData((current) => ({
                  ...current,
                  checkIn: event.target.value,
                }))
              }
            />
            <Input
              type="date"
              value={bookingData.checkOut}
              onChange={(event) =>
                setBookingData((current) => ({
                  ...current,
                  checkOut: event.target.value,
                }))
              }
            />
          </div>
          <Input
            type="number"
            min={1}
            value={bookingData.guests}
            onChange={(event) =>
              setBookingData((current) => ({
                ...current,
                guests: Number(event.target.value),
              }))
            }
          />
          <Textarea
            placeholder="Request note for the landlord"
            value={bookingData.requestNote}
            onChange={(event) =>
              setBookingData((current) => ({
                ...current,
                requestNote: event.target.value,
              }))
            }
          />
          <Button
            className="w-full"
            onClick={() =>
              bookingMutation.mutate({
                listingId: listing.id,
                guestName: bookingData.guestName,
                guestEmail: bookingData.guestEmail,
                guestPhone: bookingData.guestPhone,
                checkIn: new Date(bookingData.checkIn),
                checkOut: new Date(bookingData.checkOut),
                guests: bookingData.guests,
                requestNote: bookingData.requestNote,
              })
            }
            disabled={
              !bookingData.guestName ||
              !bookingData.guestEmail ||
              !bookingData.guestPhone ||
              !bookingData.checkIn ||
              !bookingData.checkOut
            }
          >
            Submit Request
          </Button>
        </div>
      </BookingModal>
    </Layout>
  );
}
