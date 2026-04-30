import { Skeleton } from "@/components/ui/skeleton";

export function RouteSkeleton() {
  return (
    <div className="min-h-screen px-4 py-28 md:px-6">
      <div className="container mx-auto">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-5 h-14 w-full max-w-xl" />
        <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/5] rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-16 md:px-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-sm border p-5"
            style={{
              backgroundColor: "var(--color-card)",
              borderColor: "var(--color-border)",
            }}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-10 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-4">
          <Skeleton className="h-80 rounded-sm" />
          <Skeleton className="h-40 rounded-sm" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-sm" />
          <Skeleton className="h-36 rounded-sm" />
          <Skeleton className="h-36 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function ListingDetailsSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 md:px-6">
        <Skeleton className="mb-6 h-4 w-32" />
      </div>
      <Skeleton className="h-[50vh] w-full rounded-none md:h-[60vh]" />
      <div className="container mx-auto grid gap-10 px-4 py-10 md:px-6 lg:grid-cols-[1.5fr_0.8fr]">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-14 w-full max-w-2xl" />
          <Skeleton className="mt-5 h-24 w-full" />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-sm" />
            <Skeleton className="h-24 rounded-sm" />
            <Skeleton className="h-24 rounded-sm" />
          </div>
        </div>
        <Skeleton className="h-96 rounded-sm" />
      </div>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Skeleton className="h-full w-full rounded-none" />
      <div className="absolute left-4 top-24 w-[min(24rem,calc(100vw-2rem))] rounded-sm border p-5 backdrop-blur-xl md:left-6 md:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-4 w-64 max-w-full" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-sm" />
          <Skeleton className="h-20 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

