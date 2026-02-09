import { Star, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const reviews = [
  {
    id: 1,
    name: "Sarah Johnson",
    date: "October 2023",
    rating: 5,
    text: "Absolutely stunning property! The views were breathtaking and the cabin was so cozy. We loved the fireplace and the hot tub. Highly recommend!",
    avatar: "SJ"
  },
  {
    id: 2,
    name: "Michael Chen",
    date: "September 2023",
    rating: 5,
    text: "Perfect getaway. The location is secluded yet accessible. The host was very responsive and the amenities were top notch.",
    avatar: "MC"
  },
  {
    id: 3,
    name: "Emma Davis",
    date: "August 2023",
    rating: 4,
    text: "Beautiful place, but the driveway was a bit steep. Otherwise, a fantastic stay.",
    avatar: "ED"
  },
  {
    id: 4,
    name: "James Wilson",
    date: "July 2023",
    rating: 5,
    text: "This was our second time staying here and it was just as magical as the first. Can't wait to come back!",
    avatar: "JW"
  }
];

export function ReviewSection() {
  return (
    <div className="py-12 border-t border-border">
      <h2 className="text-2xl font-semibold mb-8 flex items-center gap-2">
        <Star className="h-6 w-6 fill-black" /> 
        4.92 · 128 Reviews
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        {reviews.map((review) => (
          <div key={review.id} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{review.avatar}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{review.name}</h3>
                <p className="text-sm text-muted-foreground">{review.date}</p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {review.text}
            </p>
            {/* Mock "Helpful" interaction */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
               <ThumbsUp className="h-4 w-4" /> Helpful
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}