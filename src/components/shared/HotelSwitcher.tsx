import { ChevronDown, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";

export function HotelSwitcher() {
  const { hotels, activeHotel, selectHotel, profile } = useAuth();

  if (!activeHotel && hotels.length === 0) {
    return (
      <Button variant="outline" size="sm" className="h-9 gap-2" asChild>
        <Link to="/register">Register a hotel</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 font-normal">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </span>
          <span className="hidden max-w-[160px] truncate md:inline">{activeHotel?.name ?? "Choose hotel"}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch hotel</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hotels.map((hotel) => (
          <DropdownMenuItem
            key={hotel.id}
            onClick={() => selectHotel(hotel.id)}
            className="cursor-pointer justify-between"
          >
            <span className="truncate pr-2">{hotel.name}</span>
            {activeHotel?.id === hotel.id ? <Check className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        {profile ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/register">+ Register another hotel</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
