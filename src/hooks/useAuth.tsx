import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import type { PermissionKey, StaffRole } from "@/lib/permissions";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

export type AppRole = "platform_admin" | "hotel_owner" | "hotel_staff" | "customer";

export interface HotelSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  logo_url: string | null;
  cover_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  is_demo: boolean;
  owner_id: string | null;
  relation: "owner" | "staff" | "demo";
  staff_role: StaffRole | null;
  permissions: PermissionKey[];
}

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  hotels: HotelSummary[];
  activeHotel: HotelSummary | null;
  selectHotel: (id: string | null) => void;
  isPlatformAdmin: boolean;
  can: (permission: PermissionKey) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVE_HOTEL_KEY = "custard.activeHotel";

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) return null;
  return data as Profile;
}

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) return [];
  return (data as { role: string }[]).map((r) => r.role as AppRole);
}

async function fetchHotels(userId: string, isAdmin: boolean): Promise<HotelSummary[]> {
  const [owned, memberships, demos] = await Promise.all([
    supabase.from("hotels").select("*").eq("owner_id", userId),
    supabase.from("hotel_members").select("*, hotels(*)").eq("user_id", userId).eq("is_active", true),
    isAdmin ? { data: [] as Record<string, unknown>[], error: null } : supabase.from("hotels").select("*").eq("is_demo", true),
  ]);

  const map: Record<string, HotelSummary> = {};

  (owned.data ?? []).forEach((h: Record<string, unknown>) => {
    const hotel = h as unknown as HotelSummaryRaw;
    map[hotel.id] = {
      ...mapHotel(hotel),
      relation: "owner",
      staff_role: null,
      permissions: [],
    };
  });

  (memberships.data ?? []).forEach((m: Record<string, unknown>) => {
    const member = m as unknown as { staff_role: StaffRole; permissions: PermissionKey[]; hotels: HotelSummaryRaw };
    const hotel = member.hotels;
    map[hotel.id] = {
      ...mapHotel(hotel),
      relation: "staff",
      staff_role: member.staff_role,
      permissions: member.permissions ?? DEFAULT_ROLE_PERMISSIONS[member.staff_role] ?? [],
    };
  });

  (demos.data ?? []).forEach((h: Record<string, unknown>) => {
    const hotel = h as unknown as HotelSummaryRaw;
    if (!map[hotel.id]) {
      map[hotel.id] = {
        ...mapHotel(hotel),
        relation: "demo",
        staff_role: null,
        permissions: [],
      };
    }
  });

  return Object.values(map).sort((a, b) => {
    const order = { owner: 0, staff: 1, demo: 2 };
    return order[a.relation] - order[b.relation];
  });
}

interface HotelSummaryRaw {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  logo_url: string | null;
  cover_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  is_demo: boolean;
  owner_id: string | null;
}

function mapHotel(h: HotelSummaryRaw): Omit<HotelSummary, "relation" | "staff_role" | "permissions"> {
  return {
    id: h.id,
    name: h.name,
    slug: h.slug,
    status: h.status,
    currency: h.currency,
    logo_url: h.logo_url,
    cover_url: h.cover_url,
    onboarding_completed: h.onboarding_completed,
    onboarding_step: h.onboarding_step,
    is_demo: h.is_demo,
    owner_id: h.owner_id,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  const isPlatformAdmin = roles.includes("platform_admin");

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    setUser(s?.user ?? null);

    if (s?.user) {
      const [p, r, h] = await Promise.all([
        fetchProfile(s.user.id),
        fetchRoles(s.user.id),
        fetchHotels(s.user.id, false),
      ]);
      setProfile(p);
      setRoles(r);
      setHotels(h);

      const saved = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_HOTEL_KEY) : null;
      const hotelIds = new Set(h.map((hotel) => hotel.id));
      const selected = saved && hotelIds.has(saved) ? saved : h[0]?.id ?? null;
      setActiveHotelId(selected);
    } else {
      setProfile(null);
      setRoles([]);
      setHotels([]);
      setActiveHotelId(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        load();
      } else {
        setProfile(null);
        setRoles([]);
        setHotels([]);
        setActiveHotelId(null);
        setLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [load]);

  const activeHotel = useMemo(() => hotels.find((h) => h.id === activeHotelId) ?? hotels[0] ?? null, [hotels, activeHotelId]);

  const selectHotel = useCallback((id: string | null) => {
    setActiveHotelId(id);
    if (id && typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_HOTEL_KEY, id);
    } else if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_HOTEL_KEY);
    }
  }, []);

  const can = useCallback(
    (permission: PermissionKey) => {
      if (isPlatformAdmin) return true;
      if (!activeHotel) return false;
      if (activeHotel.relation === "owner" || activeHotel.is_demo) return true;
      return activeHotel.permissions.includes(permission);
    },
    [isPlatformAdmin, activeHotel],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setHotels([]);
    setActiveHotelId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_HOTEL_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user,
        profile,
        roles,
        hotels,
        activeHotel,
        selectHotel,
        isPlatformAdmin,
        can,
        refresh: load,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
