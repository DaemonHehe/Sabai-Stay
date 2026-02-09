import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, MapPin, Calendar as CalendarIcon, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function HeroSearch() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-full shadow-xl border border-border/50 p-2 pl-6 flex flex-col md:flex-row items-center gap-2 divide-y md:divide-y-0 md:divide-x divide-border">
      
      {/* Location */}
      <div className="flex-1 w-full p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer group">
        <div className="text-xs font-bold px-2 mb-0.5">Where</div>
        <input 
          type="text" 
          placeholder="Search destinations" 
          className="w-full bg-transparent border-none text-sm focus:ring-0 px-2 truncate placeholder:text-muted-foreground" 
        />
      </div>

      {/* Check In */}
      <div className="flex-1 w-full p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer text-left">
         <Popover>
          <PopoverTrigger asChild>
            <div className="w-full">
              <div className="text-xs font-bold px-4 mb-0.5">Check in</div>
              <div className={cn("text-sm px-4 truncate", !date && "text-muted-foreground")}>
                {date ? format(date, "MMM d") : "Add dates"}
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Check Out */}
      <div className="flex-1 w-full p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer text-left">
        <div className="text-xs font-bold px-4 mb-0.5">Check out</div>
        <div className="text-sm text-muted-foreground px-4 truncate">Add dates</div>
      </div>

      {/* Guests */}
      <div className="flex-[1.2] w-full p-2 pl-4 flex items-center justify-between hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
        <div className="text-left">
           <div className="text-xs font-bold mb-0.5">Who</div>
           <div className="text-sm text-muted-foreground truncate">Add guests</div>
        </div>
        <Button size="icon" className="rounded-full h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-lg">
          <Search className="h-5 w-5" strokeWidth={3} />
        </Button>
      </div>

    </div>
  );
}