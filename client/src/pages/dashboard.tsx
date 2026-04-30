import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/page-skeletons";
import { Card, SectionTitle } from "@/features/dashboard/dashboard-ui";
import {
  bookingStatusTransitionMap,
  contractStatusTransitionMap,
  formatCurrency,
  formatDate,
  listingStatusValues,
  toLabel,
} from "@/features/dashboard/dashboard-format";
import type {
  BookingStatus,
  ContractStatus,
  Listing,
  RoommateProfile,
} from "@shared/schema";

type OwnerBookingFilter = "triage" | "all" | BookingStatus;
type OwnerBookingSort = "newest" | "check_in" | "highest_value";
type OwnerListingFilter = "all" | Listing["listingStatus"];
type OwnerListingSort = "recent" | "price_high" | "price_low";

const listingImageContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const contractDocumentContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const maxListingImageBytes = 8 * 1024 * 1024;
const maxContractDocumentBytes = 10 * 1024 * 1024;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { profile, isLoading: isAuthLoading } = useAuth();
  const canLoadDashboard = Boolean(profile?.appUser.id) && !isAuthLoading;

  const {
    data: dashboard,
    isLoading,
    error: dashboardError,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    enabled: canLoadDashboard,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    data: discovery,
    error: discoveryError,
  } = useQuery({
    queryKey: ["discovery"],
    queryFn: api.getDiscovery,
  });

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [messageDraft, setMessageDraft] = useState("");
  const [ownerBookingSearch, setOwnerBookingSearch] = useState("");
  const [ownerBookingFilter, setOwnerBookingFilter] =
    useState<OwnerBookingFilter>("triage");
  const [ownerBookingSort, setOwnerBookingSort] =
    useState<OwnerBookingSort>("newest");
  const [ownerListingSearch, setOwnerListingSearch] = useState("");
  const [ownerListingFilter, setOwnerListingFilter] =
    useState<OwnerListingFilter>("all");
  const [ownerListingSort, setOwnerListingSort] =
    useState<OwnerListingSort>("recent");
  const [showDiscoveryForOwner, setShowDiscoveryForOwner] = useState(false);

  const [listingForm, setListingForm] = useState({
    title: "",
    location: "",
    price: 8500,
    category: "CONDO",
    roomType: "studio" as Listing["roomType"],
    walkingMinutes: 10,
  });
  const [listingImageFile, setListingImageFile] = useState<File | null>(null);
  const [contractUploadFiles, setContractUploadFiles] = useState<
    Record<string, File | null>
  >({});

  const [roommateForm, setRoommateForm] = useState<
    Omit<RoommateProfile, "id" | "createdAt" | "updatedAt">
  >({
    userId: "",
    universityId: "",
    displayName: "Mali S.",
    bio: "Medical student seeking a quiet, tidy roommate near campus.",
    studyHabit: "silent",
    sleepSchedule: "early_bird",
    cleanliness: "meticulous",
    genderPreference: "same_gender",
    budgetMin: 7000,
    budgetMax: 11000,
    preferredMoveIn: new Date("2026-05-15"),
    preferredLeaseMonths: 4,
    openToVisitors: false,
    isActive: true,
  });

  const viewerRoommateProfile = useMemo(
    () =>
      dashboard?.roommateProfiles.find(
        (roommateProfile) => roommateProfile.userId === profile?.appUser.id,
      ) ?? null,
    [dashboard?.roommateProfiles, profile?.appUser.id],
  );

  const viewerRole = profile?.appUser.role ?? null;
  const canManageListings = viewerRole === "owner";
  const canManageContracts = viewerRole === "owner";
  const canUseRoommates = viewerRole === "student";
  const canUploadContractDocuments = Boolean(viewerRole);

  const activeUniversityId =
    profile?.studentProfile?.universityId ??
    viewerRoommateProfile?.universityId ??
    discovery?.universities[0]?.id ??
    "";

  const defaultCampusZoneId =
    discovery?.campusZones.find((zone) => zone.universityId === activeUniversityId)
      ?.id ??
    discovery?.campusZones[0]?.id ??
    "";

  const defaultTransportRouteIds =
    discovery?.transportRoutes
      .filter((route) => route.universityId === activeUniversityId)
      .map((route) => route.id) ?? [];

  const listingDraftReady =
    listingForm.title.trim().length > 0 &&
    listingForm.location.trim().length > 0 &&
    Number.isFinite(Number(listingForm.price)) &&
    Number(listingForm.price) > 0 &&
    Number.isFinite(Number(listingForm.walkingMinutes)) &&
    Number(listingForm.walkingMinutes) >= 0 &&
    Boolean(activeUniversityId) &&
    Boolean(defaultCampusZoneId);

  useEffect(() => {
    const existing =
      viewerRoommateProfile ??
      dashboard?.roommateProfiles.find((roommateProfile) => roommateProfile.isActive) ??
      null;

    if (!existing) {
      setRoommateForm((current) => ({
        ...current,
        userId: profile?.appUser.id ?? "",
        universityId: activeUniversityId,
        displayName:
          profile?.appUser.fullName ?? current.displayName ?? "Current Student",
      }));
      return;
    }

    setRoommateForm({
      userId: existing.userId,
      universityId: existing.universityId,
      displayName: existing.displayName,
      bio: existing.bio,
      studyHabit: existing.studyHabit,
      sleepSchedule: existing.sleepSchedule,
      cleanliness: existing.cleanliness,
      genderPreference: existing.genderPreference,
      budgetMin: existing.budgetMin,
      budgetMax: existing.budgetMax,
      preferredMoveIn: existing.preferredMoveIn,
      preferredLeaseMonths: existing.preferredLeaseMonths,
      openToVisitors: existing.openToVisitors,
      isActive: existing.isActive,
    });
  }, [
    activeUniversityId,
    dashboard?.roommateProfiles,
    profile?.appUser.fullName,
    profile?.appUser.id,
    viewerRoommateProfile,
  ]);

  useEffect(() => {
    if (!selectedMatchId && dashboard?.roommateMatches.length) {
      setSelectedMatchId(dashboard.roommateMatches[0].id);
    }
  }, [dashboard?.roommateMatches, selectedMatchId]);

  const createListingMutation = useMutation({
    mutationFn: async () => {
      if (!listingDraftReady) {
        throw new Error(
          "Add a title, location, valid rent, walk time, and campus context before submitting.",
        );
      }

      if (
        listingImageFile &&
        !listingImageContentTypes.has(listingImageFile.type)
      ) {
        throw new Error("Listing cover image must be a PNG, JPG, or WEBP file.");
      }

      let imageUrl = "/images/condo-exterior.png";
      let gallery = ["/images/condo-exterior.png"];

      if (listingImageFile) {
        const upload = await api.createListingImageUploadUrl({
          fileName: listingImageFile.name,
          contentType: listingImageFile.type,
          fileSize: listingImageFile.size,
        });
        await api.uploadFileToSignedUrl({
          signedUploadUrl: upload.signedUploadUrl,
          file: listingImageFile,
        });
        imageUrl = upload.assetUrl;
        gallery = [upload.assetUrl];
      }

      return api.createListing({
        ownerUserId: profile?.appUser.id ?? "",
        universityId: activeUniversityId,
        title: listingForm.title.trim(),
        location: listingForm.location.trim(),
        price: Number(listingForm.price),
        rating: "0.00",
        category: listingForm.category,
        roomType: listingForm.roomType,
        image: imageUrl,
        gallery,
        description:
          "Owner-submitted listing with utility rates, lease options, and commute details.",
        latitude: "13.9650",
        longitude: "100.5900",
        areaSqm: 28,
        capacity: 2,
        bedrooms: 1,
        bathrooms: 1,
        featured: false,
        listingStatus: "draft",
        moderationStatus: "pending",
        amenities: ["Wi-Fi", "Security", "Laundry"],
        nearestCampusZoneId: defaultCampusZoneId,
        walkingMinutes: Number(listingForm.walkingMinutes),
        transportRouteIds: defaultTransportRouteIds,
        utilityRates: {
          electricityPerUnit: 7,
          waterPerUnit: 18,
          internetFee: 350,
          serviceFee: 250,
        },
        internetIncluded: false,
        leaseOptions: [
          { months: 4, label: "Semester" },
          { months: 6, label: "Half-Year" },
        ],
        availableFrom: new Date(),
        availableTo: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({
        title: "Listing submitted",
        description: "Draft saved and sent for review.",
      });
      setListingForm({
        title: "",
        location: "",
        price: 8500,
        category: "CONDO",
        roomType: "studio",
        walkingMinutes: 10,
      });
      setListingImageFile(null);
    },
    onError: (error) => {
      toast({
        title: "Unable to create listing",
        description: getErrorMessage(error, "Listing draft creation failed."),
        variant: "destructive",
      });
    },
  });

  const uploadContractDocumentMutation = useMutation({
    mutationFn: async ({
      contractId,
      file,
    }: {
      contractId: string;
      file: File;
    }) => {
      if (!contractDocumentContentTypes.has(file.type)) {
        throw new Error("Contract document must be a PDF, JPG, or PNG file.");
      }

      const upload = await api.createContractDocumentUploadUrl({
        contractId,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      await api.uploadFileToSignedUrl({
        signedUploadUrl: upload.signedUploadUrl,
        file,
      });
      return api.registerContractDocument(contractId, {
        name: file.name,
        type: file.type,
        path: upload.path,
      });
    },
    onSuccess: (_document, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setContractUploadFiles((current) => ({
        ...current,
        [variables.contractId]: null,
      }));
      toast({
        title: "Document uploaded",
        description: "Contract document was uploaded and linked successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: getErrorMessage(
          error,
          "Unable to upload and register contract document.",
        ),
        variant: "destructive",
      });
    },
  });

  const listingStatusMutation = useMutation({
    mutationFn: ({
      id,
      listingStatus,
    }: {
      id: string;
      listingStatus: Listing["listingStatus"];
    }) => api.updateListing(id, { listingStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({
        title: "Listing status updated",
        description: "Portfolio status has been refreshed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update listing",
        description: getErrorMessage(error, "Listing status update failed."),
        variant: "destructive",
      });
    },
  });

  const bookingStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      api.updateBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Booking status updated",
        description: "The booking status was saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update booking",
        description: getErrorMessage(error, "Booking status update failed."),
        variant: "destructive",
      });
    },
  });

  const contractStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContractStatus }) =>
      api.updateContractStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Contract updated",
        description: "Contract state and document readiness were updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update contract",
        description: getErrorMessage(error, "Contract status update failed."),
        variant: "destructive",
      });
    },
  });

  const roommateProfileMutation = useMutation({
    mutationFn: () => api.saveRoommateProfile(roommateForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Roommate profile saved",
        description: "Your preferences were updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to save profile",
        description: getErrorMessage(error, "Roommate profile update failed."),
        variant: "destructive",
      });
    },
  });

  const messageMutation = useMutation({
    mutationFn: () =>
      api.sendRoommateMessage({
        matchId: selectedMatchId,
        senderProfileId: viewerRoommateProfile?.id ?? "",
        message: messageDraft,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setMessageDraft("");
      toast({
        title: "Message sent",
        description: "Your message was sent.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to send message",
        description: getErrorMessage(error, "Roommate message failed."),
        variant: "destructive",
      });
    },
  });

  const notificationMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast({
        title: "Unable to update notification",
        description: getErrorMessage(error, "Notification update failed."),
        variant: "destructive",
      });
    },
  });

  const selectedMessages = useMemo(
    () =>
      dashboard?.roommateMessages.filter(
        (message) => message.matchId === selectedMatchId,
      ) ?? [],
    [dashboard?.roommateMessages, selectedMatchId],
  );

  const ownerListingsById = useMemo(
    () =>
      new Map((dashboard?.ownerListings ?? []).map((listing) => [listing.id, listing])),
    [dashboard?.ownerListings],
  );

  const contractsByBookingId = useMemo(
    () =>
      new Map((dashboard?.contracts ?? []).map((contract) => [contract.bookingId, contract])),
    [dashboard?.contracts],
  );

  const ownerBookingCounts = useMemo(() => {
    const counts: Record<BookingStatus, number> = {
      requested: 0,
      approved: 0,
      deposit_pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
    };

    for (const booking of dashboard?.ownerBookings ?? []) {
      counts[booking.status] += 1;
    }

    return counts;
  }, [dashboard?.ownerBookings]);

  const ownerFilteredBookings = useMemo(() => {
    let bookings = [...(dashboard?.ownerBookings ?? [])];
    const search = ownerBookingSearch.trim().toLowerCase();

    if (ownerBookingFilter === "triage") {
      bookings = bookings.filter(
        (booking) =>
          booking.status === "requested" ||
          booking.status === "approved" ||
          booking.status === "deposit_pending",
      );
    } else if (ownerBookingFilter !== "all") {
      bookings = bookings.filter((booking) => booking.status === ownerBookingFilter);
    }

    if (search) {
      bookings = bookings.filter((booking) => {
        const listingTitle = ownerListingsById.get(booking.listingId)?.title ?? "";
        return (
          booking.guestName.toLowerCase().includes(search) ||
          booking.guestEmail.toLowerCase().includes(search) ||
          booking.requestNote.toLowerCase().includes(search) ||
          listingTitle.toLowerCase().includes(search)
        );
      });
    }

    bookings.sort((a, b) => {
      if (ownerBookingSort === "highest_value") {
        return b.totalPrice - a.totalPrice;
      }
      if (ownerBookingSort === "check_in") {
        return a.checkIn.getTime() - b.checkIn.getTime();
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return bookings;
  }, [
    dashboard?.ownerBookings,
    ownerBookingFilter,
    ownerBookingSearch,
    ownerBookingSort,
    ownerListingsById,
  ]);

  const ownerListingCounts = useMemo(
    () => ({
      draft: (dashboard?.ownerListings ?? []).filter(
        (listing) => listing.listingStatus === "draft",
      ).length,
      active: (dashboard?.ownerListings ?? []).filter(
        (listing) => listing.listingStatus === "active",
      ).length,
      archived: (dashboard?.ownerListings ?? []).filter(
        (listing) => listing.listingStatus === "archived",
      ).length,
      flagged: (dashboard?.ownerListings ?? []).filter(
        (listing) => listing.moderationStatus === "flagged",
      ).length,
      pendingModeration: (dashboard?.ownerListings ?? []).filter(
        (listing) => listing.moderationStatus === "pending",
      ).length,
    }),
    [dashboard?.ownerListings],
  );

  const ownerFilteredListings = useMemo(() => {
    let listings = [...(dashboard?.ownerListings ?? [])];
    const search = ownerListingSearch.trim().toLowerCase();

    if (ownerListingFilter !== "all") {
      listings = listings.filter(
        (listing) => listing.listingStatus === ownerListingFilter,
      );
    }

    if (search) {
      listings = listings.filter(
        (listing) =>
          listing.title.toLowerCase().includes(search) ||
          listing.location.toLowerCase().includes(search) ||
          listing.category.toLowerCase().includes(search),
      );
    }

    listings.sort((a, b) => {
      if (ownerListingSort === "price_high") {
        return b.price - a.price;
      }
      if (ownerListingSort === "price_low") {
        return a.price - b.price;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return listings;
  }, [
    dashboard?.ownerListings,
    ownerListingFilter,
    ownerListingSearch,
    ownerListingSort,
  ]);

  if (!isAuthLoading && !profile?.appUser.id) {
    return (
      <Layout>
        <div className="container mx-auto px-4 md:px-6 py-16">
          <Card>
            <p className="font-display text-2xl font-bold uppercase">
              Dashboard Unavailable
            </p>
            <p className="mt-3 text-sm opacity-70">
              Your session is not active. Sign in as Student or Owner to open the
              dashboard.
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (dashboardError) {
    const message =
      dashboardError instanceof Error
        ? dashboardError.message
        : "Sign in with a valid account and confirm the database schema is applied.";
    const isForbiddenError = message.toLowerCase().includes("forbidden");

    return (
      <Layout>
        <div className="container mx-auto px-4 md:px-6 py-16">
          <Card>
            <p className="font-display text-2xl font-bold uppercase">
              Dashboard Unavailable
            </p>
            <p className="mt-3 text-sm opacity-70">
              {isForbiddenError
                  ? "Your account does not have permission for this dashboard action."
                  : message}
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (discoveryError) {
    return (
      <Layout>
        <div className="container mx-auto px-4 md:px-6 py-16">
          <Card>
            <p className="font-display text-2xl font-bold uppercase">
              Discovery Data Unavailable
            </p>
            <p className="mt-3 text-sm opacity-70">
              Campus zones and transport routes could not be loaded from the
              database.
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isAuthLoading || isLoading || !dashboard || !discovery) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 md:px-6 space-y-14">
        {canManageListings ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Card>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
                Portfolio Size
              </p>
              <p className="mt-2 text-4xl font-display font-bold">
                {dashboard.ownerAnalytics.listingCount}
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
                Active Listings
              </p>
              <p className="mt-2 text-4xl font-display font-bold">
                {dashboard.ownerAnalytics.activeListings}
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
                Pending Requests
              </p>
              <p className="mt-2 text-4xl font-display font-bold">
                {dashboard.ownerAnalytics.pendingRequests}
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
                Occupancy Rate
              </p>
              <p className="mt-2 text-4xl font-display font-bold">
                {dashboard.ownerAnalytics.occupancyRate}%
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
                Response Rate
              </p>
              <p className="mt-2 text-4xl font-display font-bold">
                {dashboard.ownerAnalytics.responseRate}%
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-40">
                Confirmed Revenue
              </p>
              <p className="mt-2 text-2xl font-display font-bold text-primary">
                {formatCurrency(dashboard.ownerAnalytics.confirmedRevenue)}
              </p>
            </Card>
          </div>
        ) : null}

        {!canManageListings ? (
          <Card>
            <p className="font-display text-lg font-bold uppercase">
              Owner Workspace Locked
            </p>
            <p className="mt-2 text-sm opacity-70">
              Listing creation and booking management are available for Owner
              accounts only.
            </p>
          </Card>
        ) : null}

        {canManageListings ? (
          <section>
            <SectionTitle
              kicker="Owner Operations"
              title="Listings, Requests, And Analytics"
              description="Manage listings, handle booking requests, and track performance in one place."
            />
            <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
              <div className="space-y-4">
                <Card>
                  <p className="font-display font-bold uppercase">Create Listing Draft</p>
                  <div className="mt-4 space-y-3">
                    <Input
                      placeholder="Listing title"
                      value={listingForm.title}
                      onChange={(event) =>
                        setListingForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Location"
                      value={listingForm.location}
                      onChange={(event) =>
                        setListingForm((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        placeholder="Monthly Price"
                        value={listingForm.price}
                        onChange={(event) =>
                          setListingForm((current) => ({
                            ...current,
                            price: Number(event.target.value),
                          }))
                        }
                      />
                      <Input
                        type="number"
                        placeholder="Walk Minutes"
                        value={listingForm.walkingMinutes}
                        onChange={(event) =>
                          setListingForm((current) => ({
                            ...current,
                            walkingMinutes: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        className="h-10 rounded-md border px-3 text-sm"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                        value={listingForm.category}
                        onChange={(event) =>
                          setListingForm((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                      >
                        <option>CONDO</option>
                        <option>DORM</option>
                        <option>LUXURY</option>
                        <option>LOFT</option>
                        <option>RESORT</option>
                      </select>
                      <select
                        className="h-10 rounded-md border px-3 text-sm"
                        style={{
                          backgroundColor: "var(--color-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                        value={listingForm.roomType}
                        onChange={(event) =>
                          setListingForm((current) => ({
                            ...current,
                            roomType: event.target.value as Listing["roomType"],
                          }))
                        }
                      >
                        <option value="studio">studio</option>
                        <option value="dorm">dorm</option>
                        <option value="condo">condo</option>
                        <option value="apartment">apartment</option>
                        <option value="loft">loft</option>
                        <option value="shared">shared</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (!file) {
                            setListingImageFile(null);
                            return;
                          }
                          if (!listingImageContentTypes.has(file.type)) {
                            event.target.value = "";
                            setListingImageFile(null);
                            toast({
                              title: "Unsupported image",
                              description:
                                "Choose a PNG, JPG, or WEBP listing cover image.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (file.size > maxListingImageBytes) {
                            event.target.value = "";
                            setListingImageFile(null);
                            toast({
                              title: "Image too large",
                              description: "Listing cover images must be 8 MB or less.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setListingImageFile(file);
                        }}
                      />
                      <p className="text-xs opacity-60">
                        {listingImageFile
                          ? `Selected image: ${listingImageFile.name}`
                          : "Optional: upload a listing cover image (PNG/JPG/WEBP)."}
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createListingMutation.mutate()}
                      disabled={
                        !listingDraftReady ||
                        createListingMutation.isPending
                      }
                    >
                      {createListingMutation.isPending
                        ? "Submitting..."
                        : "Submit Draft"}
                    </Button>
                  </div>
                </Card>

                <Card>
                  <p className="font-display font-bold uppercase">Portfolio Health</p>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-sm border px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
                      Draft listings: {ownerListingCounts.draft}
                    </div>
                    <div className="rounded-sm border px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
                      Active listings: {ownerListingCounts.active}
                    </div>
                    <div className="rounded-sm border px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
                      Archived listings: {ownerListingCounts.archived}
                    </div>
                    <div className="rounded-sm border px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
                      Pending moderation: {ownerListingCounts.pendingModeration}
                    </div>
                  </div>
                  <p className="mt-3 text-xs opacity-60">
                    Flagged by moderation: {ownerListingCounts.flagged}
                  </p>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display font-bold uppercase">Booking Command Center</p>
                    <p className="text-xs opacity-60">
                      Showing {ownerFilteredBookings.length} of {dashboard.ownerBookings.length}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                    <Input
                      value={ownerBookingSearch}
                      onChange={(event) => setOwnerBookingSearch(event.target.value)}
                      placeholder="Search guest, email, listing, note"
                    />
                    <select
                      className="h-10 rounded-md border px-3 text-sm"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                      value={ownerBookingFilter}
                      onChange={(event) =>
                        setOwnerBookingFilter(event.target.value as OwnerBookingFilter)
                      }
                    >
                      <option value="triage">triage queue</option>
                      <option value="all">all statuses</option>
                      <option value="requested">requested</option>
                      <option value="approved">approved</option>
                      <option value="deposit_pending">deposit pending</option>
                      <option value="confirmed">confirmed</option>
                      <option value="rejected">rejected</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                    <select
                      className="h-10 rounded-md border px-3 text-sm"
                      style={{
                        backgroundColor: "var(--color-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                      value={ownerBookingSort}
                      onChange={(event) =>
                        setOwnerBookingSort(event.target.value as OwnerBookingSort)
                      }
                    >
                      <option value="newest">newest first</option>
                      <option value="check_in">earliest check-in</option>
                      <option value="highest_value">highest value</option>
                    </select>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {([
                      {
                        label: "Requested",
                        value: "requested",
                        count: ownerBookingCounts.requested,
                      },
                      {
                        label: "Approved",
                        value: "approved",
                        count: ownerBookingCounts.approved,
                      },
                      {
                        label: "Deposit Pending",
                        value: "deposit_pending",
                        count: ownerBookingCounts.deposit_pending,
                      },
                      {
                        label: "Confirmed",
                        value: "confirmed",
                        count: ownerBookingCounts.confirmed,
                      },
                    ] as const).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-wider"
                        style={{ borderColor: "var(--color-border)" }}
                        onClick={() => setOwnerBookingFilter(item.value)}
                      >
                        {item.label}: {item.count}
                      </button>
                    ))}
                  </div>
                </Card>

                {ownerFilteredBookings.length ? (
                  ownerFilteredBookings.map((booking) => {
                    const listing = ownerListingsById.get(booking.listingId);
                    const linkedContract = contractsByBookingId.get(booking.id);
                    const nextStatuses = bookingStatusTransitionMap[booking.status];

                    return (
                      <Card key={booking.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-display text-xl font-bold uppercase">
                              {booking.guestName}
                            </p>
                            <p className="text-sm opacity-60">
                              {listing?.title ?? "Listing"} | {toLabel(booking.status)} |{" "}
                              {formatCurrency(booking.totalPrice)}
                            </p>
                            <p className="text-xs opacity-50">
                              {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)} |{" "}
                              {booking.guestEmail}
                            </p>
                            {linkedContract ? (
                              <p className="text-xs opacity-50">
                                Contract: {toLabel(linkedContract.status)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {nextStatuses.map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() =>
                                  bookingStatusMutation.mutate({ id: booking.id, status })
                                }
                                disabled={bookingStatusMutation.isPending}
                                className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-wider disabled:opacity-50"
                                style={{ borderColor: "var(--color-border)" }}
                              >
                                Mark {toLabel(status)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {booking.requestNote ? (
                          <p className="mt-3 text-sm opacity-70">{booking.requestNote}</p>
                        ) : null}
                      </Card>
                    );
                  })
                ) : (
                  <Card>
                    <p className="font-display text-lg font-bold uppercase">
                      No bookings match this view
                    </p>
                    <p className="mt-2 text-sm opacity-70">
                      Adjust the queue filter or search to surface more requests.
                    </p>
                  </Card>
                )}
              </div>
            </div>

            <div className="mt-6">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-display font-bold uppercase">Listing Portfolio</p>
                  <p className="text-xs opacity-60">
                    Showing {ownerFilteredListings.length} of {dashboard.ownerListings.length}
                  </p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Input
                    value={ownerListingSearch}
                    onChange={(event) => setOwnerListingSearch(event.target.value)}
                    placeholder="Search listing title, location, category"
                  />
                  <select
                    className="h-10 rounded-md border px-3 text-sm"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                    value={ownerListingFilter}
                    onChange={(event) =>
                      setOwnerListingFilter(event.target.value as OwnerListingFilter)
                    }
                  >
                    <option value="all">all statuses</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                  <select
                    className="h-10 rounded-md border px-3 text-sm"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      borderColor: "var(--color-border)",
                    }}
                    value={ownerListingSort}
                    onChange={(event) =>
                      setOwnerListingSort(event.target.value as OwnerListingSort)
                    }
                  >
                    <option value="recent">recent first</option>
                    <option value="price_high">highest rent</option>
                    <option value="price_low">lowest rent</option>
                  </select>
                </div>
                <div className="mt-4 space-y-3">
                  {ownerFilteredListings.length ? (
                    ownerFilteredListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="rounded-sm border p-3"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{listing.title}</p>
                            <p className="text-sm opacity-60">
                              {listing.location} | {formatCurrency(listing.price)} |{" "}
                              {listing.roomType}
                            </p>
                            <p className="text-xs opacity-50">
                              Status: {toLabel(listing.listingStatus)} | Moderation:{" "}
                              {toLabel(listing.moderationStatus)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {listingStatusValues
                              .filter((status) => status !== listing.listingStatus)
                              .map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() =>
                                    listingStatusMutation.mutate({
                                      id: listing.id,
                                      listingStatus: status,
                                    })
                                  }
                                  disabled={listingStatusMutation.isPending}
                                  className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-wider disabled:opacity-50"
                                  style={{ borderColor: "var(--color-border)" }}
                                >
                                  Set {toLabel(status)}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm opacity-60">
                      No listings match this portfolio filter.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {canManageListings ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold uppercase">Campus Intelligence</p>
                <p className="mt-1 text-sm opacity-60">
                  Keep this collapsed while operating bookings, and open when tuning
                  commute context.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowDiscoveryForOwner((current) => !current)}
              >
                {showDiscoveryForOwner ? "Hide Discovery" : "Show Discovery"}
              </Button>
            </div>
          </Card>
        ) : null}

        {!canManageListings || showDiscoveryForOwner ? (
          <section>
            <SectionTitle
              kicker="Discovery"
              title="Campus Navigation And Search"
              description="University-aware search includes campus zones, transport routes, room type, capacity, and walking-time context."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <p className="font-display font-bold uppercase">Universities</p>
                <div className="mt-4 space-y-3">
                  {discovery.universities.map((university) => (
                    <div key={university.id} className="text-sm">
                      <p className="font-semibold">{university.name}</p>
                      <p className="opacity-60">
                        {university.campus ?? "Campus not set"} | {university.emailDomain}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <p className="font-display font-bold uppercase">Campus Zones</p>
                <div className="mt-4 space-y-3">
                  {discovery.campusZones.map((zone) => (
                    <div key={zone.id} className="text-sm">
                      <p className="font-semibold">{zone.name}</p>
                      <p className="opacity-60">{zone.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <p className="font-display font-bold uppercase">Transport Routes</p>
                <div className="mt-4 space-y-3">
                  {discovery.transportRoutes.map((route) => (
                    <div key={route.id} className="text-sm">
                      <p className="font-semibold">{route.name}</p>
                      <p className="opacity-60">
                        {route.mode} | {route.description}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle
            kicker="Contracts"
            title="Lease Terms And Documents"
            description="Contracts now track semester terms, signature readiness, active status, and supporting document packets."
          />
          {dashboard.contracts.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {dashboard.contracts.map((contract) => {
                const listing = ownerListingsById.get(contract.listingId);
                const nextStatuses = contractStatusTransitionMap[contract.status];

                return (
                  <Card key={contract.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-bold uppercase">
                          {toLabel(contract.status)}
                        </p>
                        <p className="text-sm opacity-60">
                          {listing?.title ?? contract.listingId} | {contract.leaseTermMonths}{" "}
                          months
                        </p>
                        <p className="text-xs opacity-50">
                          {formatDate(contract.startDate)} to {formatDate(contract.endDate)} |{" "}
                          {contract.documents.length} documents
                        </p>
                      </div>
                      {canManageContracts ? (
                        <div className="flex flex-wrap gap-2">
                          {nextStatuses.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                contractStatusMutation.mutate({ id: contract.id, status })
                              }
                              disabled={contractStatusMutation.isPending}
                              className="rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-wider disabled:opacity-50"
                              style={{ borderColor: "var(--color-border)" }}
                            >
                              Mark {toLabel(status)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2 text-sm opacity-70">
                      {contract.documents.length ? (
                        contract.documents.map((document) => (
                          <p key={document.id}>{document.name}</p>
                        ))
                      ) : (
                        <p className="text-xs opacity-60">
                          No documents uploaded yet.
                        </p>
                      )}
                    </div>
                    {canUploadContractDocuments ? (
                      <div className="mt-4 rounded-sm border p-3" style={{ borderColor: "var(--color-border)" }}>
                        <Input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            if (!file) {
                              setContractUploadFiles((current) => ({
                                ...current,
                                [contract.id]: null,
                              }));
                              return;
                            }
                            if (!contractDocumentContentTypes.has(file.type)) {
                              event.target.value = "";
                              setContractUploadFiles((current) => ({
                                ...current,
                                [contract.id]: null,
                              }));
                              toast({
                                title: "Unsupported document",
                                description: "Choose a PDF, JPG, or PNG contract file.",
                                variant: "destructive",
                              });
                              return;
                            }
                            if (file.size > maxContractDocumentBytes) {
                              event.target.value = "";
                              setContractUploadFiles((current) => ({
                                ...current,
                                [contract.id]: null,
                              }));
                              toast({
                                title: "Document too large",
                                description: "Contract documents must be 10 MB or less.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setContractUploadFiles((current) => ({
                              ...current,
                              [contract.id]: file,
                            }));
                          }}
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-xs opacity-60">
                            {contractUploadFiles[contract.id]
                              ? contractUploadFiles[contract.id]?.name
                              : "Upload PDF/JPG/PNG contract documents via signed URL."}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              !contractUploadFiles[contract.id] ||
                              uploadContractDocumentMutation.isPending
                            }
                            onClick={() => {
                              const file = contractUploadFiles[contract.id];
                              if (!file) return;
                              uploadContractDocumentMutation.mutate({
                                contractId: contract.id,
                                file,
                              });
                            }}
                          >
                            {uploadContractDocumentMutation.isPending
                              ? "Uploading..."
                              : "Upload"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <p className="font-display text-lg font-bold uppercase">No contracts yet</p>
              <p className="mt-2 text-sm opacity-70">
                Contracts will appear here after booking approval and contract
                generation.
              </p>
            </Card>
          )}
        </section>

        {canUseRoommates ? (
          <section>
            <SectionTitle
              kicker="Roommates"
              title="Preference Matching And Messaging"
              description="Students can save structured roommate preferences, browse compatibility matches, and message each other directly."
            />
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr_1fr]">
              <Card>
                <p className="font-display font-bold uppercase">Edit Profile</p>
                <div className="mt-4 space-y-3">
                  <Input
                    value={roommateForm.displayName}
                    onChange={(event) =>
                      setRoommateForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                  <Textarea
                    value={roommateForm.bio}
                    onChange={(event) =>
                      setRoommateForm((current) => ({
                        ...current,
                        bio: event.target.value,
                      }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      value={roommateForm.budgetMin}
                      onChange={(event) =>
                        setRoommateForm((current) => ({
                          ...current,
                          budgetMin: Number(event.target.value),
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={roommateForm.budgetMax}
                      onChange={(event) =>
                        setRoommateForm((current) => ({
                          ...current,
                          budgetMax: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <Button
                    onClick={() => roommateProfileMutation.mutate()}
                    disabled={!activeUniversityId}
                  >
                    Save Roommate Profile
                  </Button>
                </div>
              </Card>

              <Card>
                <p className="font-display font-bold uppercase">Compatibility Matches</p>
                <div className="mt-4 space-y-3">
                  {dashboard.roommateMatches.map((match) => {
                    const roommate = dashboard.roommateProfiles.find(
                      (item) => item.id === match.matchedProfileId,
                    );

                    return (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() => setSelectedMatchId(match.id)}
                        className="block w-full rounded-sm border p-3 text-left"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <p className="font-semibold">
                          {roommate?.displayName} | {match.compatibilityScore}%
                        </p>
                        <div className="mt-2 space-y-1 text-sm opacity-70">
                          {match.sharedHighlights.map((highlight) => (
                            <p key={highlight}>{highlight}</p>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <p className="font-display font-bold uppercase">Messages</p>
                <div className="mt-4 space-y-3">
                  <div className="max-h-56 space-y-2 overflow-auto">
                    {selectedMessages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-sm border p-3 text-sm"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        {message.message}
                      </div>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Write a roommate message"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                  />
                  <Button
                    onClick={() => messageMutation.mutate()}
                    disabled={
                      !selectedMatchId ||
                      !messageDraft.trim() ||
                      !viewerRoommateProfile?.id
                    }
                  >
                    Send Message
                  </Button>
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {!canUseRoommates ? (
          <Card>
            <p className="font-display text-lg font-bold uppercase">
              Roommate Matching Is Student-Only
            </p>
            <p className="mt-2 text-sm opacity-70">
              Switch to a Student account to edit roommate preferences and message
              matches.
            </p>
          </Card>
        ) : null}

        <section>
          <SectionTitle
            kicker="Notifications"
            title="Recent Alerts"
            description="Booking updates, contract changes, and roommate activity appear here."
          />
          <div className="grid gap-4">
            {dashboard.notifications.map((notification) => (
              <Card key={notification.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-bold uppercase">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm opacity-70">{notification.body}</p>
                  </div>
                  {!notification.read ? (
                    <Button
                      variant="outline"
                      onClick={() => notificationMutation.mutate(notification.id)}
                    >
                      Mark Read
                    </Button>
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-wider opacity-40">
                      Read
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
