import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerHotel } from "@/lib/hotels.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { registerHotelSchema } from "@/lib/hotels.functions";
import { zodFieldErrors } from "@/lib/validation";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register your hotel — Custard Hotels" },
      {
        name: "description",
        content: "Register your hotel, guest house, or serviced apartment on Custard Hotels.",
      },
      { property: "og:title", content: "Register your hotel — Custard Hotels" },
      {
        property: "og:description",
        content: "Register your hotel, guest house, or serviced apartment on Custard Hotels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

const HOTEL_TYPES = [
  "Hotel",
  "Guest House",
  "Boutique Hotel",
  "Resort",
  "Serviced Apartment",
  "Motel",
  "Hostel",
  "Lodge",
  "Airbnb / Vacation Rental",
  "Conference Hotel",
];

const REGISTER_STEPS = [
  { label: "Register", desc: "Submit your property details." },
  { label: "Review", desc: "Custard Hotels approves or rejects it." },
  { label: "Set up", desc: "Add rooms, rates and payment methods." },
  { label: "Operate", desc: "Invite staff, take bookings, go public." },
];

const KINETIC_INPUT =
  "h-11 rounded-none border-[3px] border-ink bg-background px-3 shadow-none transition-shadow focus-visible:ring-0 focus-visible:shadow-hard";
const KINETIC_TEXTAREA =
  "rounded-none border-[3px] border-ink bg-background shadow-none transition-shadow focus-visible:ring-0 focus-visible:shadow-hard";
const KINETIC_SELECT =
  "h-11 rounded-none border-[3px] border-ink bg-card shadow-none transition-shadow focus:ring-0 focus:shadow-hard";

function FieldError({ id, error }: { id?: string; error: string | undefined }) {
  if (!error) return null;
  return (
    <p id={id} className="animate-rise mt-1 text-xs font-medium text-destructive">
      {error}
    </p>
  );
}

function RegisterPage() {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const register = useServerFn(registerHotel);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    description: "",
    hotel_type: "Hotel",
    address: "",
    city: "",
    region: "",
    country: "Ghana",
    phone: "",
    email: "",
    website: "",
    room_count: 0,
    currency: "GHS",
    timezone: "Africa/Accra",
    check_in_time: "14:00",
    check_out_time: "11:00",
    tax_percent: 12.5,
    service_charge_percent: 5,
    cancellation_policy: "",
    contact_name: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form | "slug", string>>>({});

  const updateField = (key: keyof typeof form, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    slug: slugify(form.name),
    hotel_type: form.hotel_type,
    description: form.description.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    region: form.region.trim(),
    country: form.country.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    website: form.website.trim(),
    currency: form.currency,
    timezone: form.timezone,
    check_in_time: form.check_in_time,
    check_out_time: form.check_out_time,
    tax_percent: form.tax_percent,
    service_charge_percent: form.service_charge_percent,
    amenities: [],
  });

  const validate = () => {
    const parsed = registerHotelSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      navigate({ to: "/auth", search: { redirect: window.location.href } });
      return;
    }
    const payload = validate();
    if (!payload) {
      if (step !== 1) setStep(1);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setLoading(true);
    try {
      const result = await register({ data: payload });
      toast.success("Hotel registered successfully.");
      await refresh();
      navigate({ to: "/onboarding", search: { hotelId: result.hotelId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sand px-4">
        <div className="relative w-full max-w-md animate-rise ink shadow-hard-lg bg-card p-6 text-center sm:p-8">
          <span className="ink inline-block -rotate-1 bg-amber px-3 py-1 kinetic-label text-xs text-amber-foreground">
            SIGN IN FIRST
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold uppercase leading-[0.85] tracking-tighter sm:text-4xl">
            <span className="animate-swipe block">Get started</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            You need an account to register a hotel.
          </p>
          <Button
            className="kinetic-press mt-6 h-12 w-full rounded-none border-[3px] border-ink bg-ink font-display text-sm font-extrabold uppercase tracking-wider text-background shadow-hard hover:bg-ink/85"
            asChild
          >
            <Link to="/auth" search={{ redirect: window.location.href }}>
              Sign in or create account
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl animate-rise ink shadow-hard-lg bg-card p-6 sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Link to="/" className="font-display text-2xl font-extrabold italic tracking-tighter">
            CUSTARD<span className="text-primary">.</span>
          </Link>
          <span className="ink -rotate-1 bg-amber px-3 py-1 kinetic-label text-[10px] text-amber-foreground sm:text-xs">
            HOTEL ONBOARDING
          </span>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.85] tracking-tighter sm:text-5xl">
            <span className="animate-swipe block">List your</span>
            <span className="animate-swipe block text-primary underline decoration-[6px] underline-offset-[6px] [animation-delay:120ms]">
              stay.
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your property. You can complete the rest after registration.
          </p>
        </div>

        <ol className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REGISTER_STEPS.map((s, i) => (
            <li
              key={s.label}
              className={cn("ink p-3", i === 0 ? "bg-amber shadow-hard" : "bg-card")}
            >
              <span className="kinetic-label block text-[10px] text-muted-foreground">
                STEP {i + 1}
              </span>
              <span className="kinetic-label mt-1 block text-sm text-foreground">{s.label}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                {s.desc}
              </span>
            </li>
          ))}
        </ol>

        <div className="mb-6 grid grid-cols-2 border-[3px] border-ink bg-card shadow-hard">
          <div
            className={cn(
              "kinetic-label px-3 py-3 text-center text-xs uppercase tracking-widest transition-colors",
              step === 1 ? "bg-amber text-amber-foreground" : "bg-card text-muted-foreground",
            )}
          >
            1. Property
          </div>
          <div
            className={cn(
              "kinetic-label border-l-[3px] border-ink px-3 py-3 text-center text-xs uppercase tracking-widest transition-colors",
              step === 2 ? "bg-amber text-amber-foreground" : "bg-card text-muted-foreground",
            )}
          >
            2. Operations
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label
                  htmlFor="name"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.name && "text-destructive",
                  )}
                >
                  Hotel name
                </Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.name && "border-destructive")}
                />
                <FieldError id="name-error" error={errors.name} />
              </div>
              <div className="sm:col-span-2">
                <Label
                  htmlFor="description"
                  className="kinetic-label text-xs uppercase tracking-widest"
                >
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className={KINETIC_TEXTAREA}
                />
              </div>
              <div>
                <Label className="kinetic-label text-xs uppercase tracking-widest">
                  Property type
                </Label>
                <Select value={form.hotel_type} onValueChange={(v) => updateField("hotel_type", v)}>
                  <SelectTrigger
                    className={cn(KINETIC_SELECT, errors.hotel_type && "border-destructive")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[3px] border-ink shadow-hard">
                    {HOTEL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError error={errors.hotel_type} />
              </div>
              <div>
                <Label
                  htmlFor="room_count"
                  className="kinetic-label text-xs uppercase tracking-widest"
                >
                  Number of rooms
                </Label>
                <Input
                  id="room_count"
                  type="number"
                  min={0}
                  value={form.room_count}
                  onChange={(e) => updateField("room_count", parseInt(e.target.value || "0", 10))}
                  className={KINETIC_INPUT}
                />
              </div>
              <div className="sm:col-span-2">
                <Label
                  htmlFor="address"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.address && "text-destructive",
                  )}
                >
                  Address
                </Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? "address-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.address && "border-destructive")}
                />
                <FieldError id="address-error" error={errors.address} />
              </div>
              <div>
                <Label
                  htmlFor="city"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.city && "text-destructive",
                  )}
                >
                  City
                </Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  aria-invalid={Boolean(errors.city)}
                  aria-describedby={errors.city ? "city-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.city && "border-destructive")}
                />
                <FieldError id="city-error" error={errors.city} />
              </div>
              <div>
                <Label
                  htmlFor="region"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.region && "text-destructive",
                  )}
                >
                  Region
                </Label>
                <Input
                  id="region"
                  value={form.region}
                  onChange={(e) => updateField("region", e.target.value)}
                  aria-invalid={Boolean(errors.region)}
                  aria-describedby={errors.region ? "region-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.region && "border-destructive")}
                />
                <FieldError id="region-error" error={errors.region} />
              </div>
              <div>
                <Label htmlFor="phone" className="kinetic-label text-xs uppercase tracking-widest">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className={KINETIC_INPUT}
                />
              </div>
              <div>
                <Label
                  htmlFor="email"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.email && "text-destructive",
                  )}
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.email && "border-destructive")}
                />
                <FieldError id="email-error" error={errors.email} />
              </div>
              <div className="sm:col-span-2">
                <Label
                  htmlFor="website"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.website && "text-destructive",
                  )}
                >
                  Website
                </Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  aria-invalid={Boolean(errors.website)}
                  aria-describedby={errors.website ? "website-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.website && "border-destructive")}
                />
                <FieldError id="website-error" error={errors.website} />
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className="kinetic-label text-xs uppercase tracking-widest">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                  <SelectTrigger className={KINETIC_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[3px] border-ink shadow-hard">
                    <SelectItem value="GHS">GHS — Ghana Cedi</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="kinetic-label text-xs uppercase tracking-widest">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => updateField("timezone", v)}>
                  <SelectTrigger className={KINETIC_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[3px] border-ink shadow-hard">
                    <SelectItem value="Africa/Accra">Africa/Accra</SelectItem>
                    <SelectItem value="Africa/Lagos">Africa/Lagos</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="check_in_time"
                  className="kinetic-label text-xs uppercase tracking-widest"
                >
                  Check-in time
                </Label>
                <Input
                  id="check_in_time"
                  type="time"
                  value={form.check_in_time}
                  onChange={(e) => updateField("check_in_time", e.target.value)}
                  className={KINETIC_INPUT}
                />
              </div>
              <div>
                <Label
                  htmlFor="check_out_time"
                  className="kinetic-label text-xs uppercase tracking-widest"
                >
                  Check-out time
                </Label>
                <Input
                  id="check_out_time"
                  type="time"
                  value={form.check_out_time}
                  onChange={(e) => updateField("check_out_time", e.target.value)}
                  className={KINETIC_INPUT}
                />
              </div>
              <div>
                <Label
                  htmlFor="tax_percent"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.tax_percent && "text-destructive",
                  )}
                >
                  Tax %
                </Label>
                <Input
                  id="tax_percent"
                  type="number"
                  step="0.01"
                  value={form.tax_percent}
                  onChange={(e) => updateField("tax_percent", parseFloat(e.target.value || "0"))}
                  aria-invalid={Boolean(errors.tax_percent)}
                  aria-describedby={errors.tax_percent ? "tax_percent-error" : undefined}
                  className={cn(KINETIC_INPUT, errors.tax_percent && "border-destructive")}
                />
                <FieldError id="tax_percent-error" error={errors.tax_percent} />
              </div>
              <div>
                <Label
                  htmlFor="service_charge_percent"
                  className={cn(
                    "kinetic-label text-xs uppercase tracking-widest",
                    errors.service_charge_percent && "text-destructive",
                  )}
                >
                  Service charge %
                </Label>
                <Input
                  id="service_charge_percent"
                  type="number"
                  step="0.01"
                  value={form.service_charge_percent}
                  onChange={(e) =>
                    updateField("service_charge_percent", parseFloat(e.target.value || "0"))
                  }
                  aria-invalid={Boolean(errors.service_charge_percent)}
                  aria-describedby={
                    errors.service_charge_percent ? "service_charge_percent-error" : undefined
                  }
                  className={cn(
                    KINETIC_INPUT,
                    errors.service_charge_percent && "border-destructive",
                  )}
                />
                <FieldError
                  id="service_charge_percent-error"
                  error={errors.service_charge_percent}
                />
              </div>
              <div className="sm:col-span-2">
                <Label
                  htmlFor="cancellation_policy"
                  className="kinetic-label text-xs uppercase tracking-widest"
                >
                  Cancellation policy
                </Label>
                <Textarea
                  id="cancellation_policy"
                  value={form.cancellation_policy}
                  onChange={(e) => updateField("cancellation_policy", e.target.value)}
                  className={KINETIC_TEXTAREA}
                />
              </div>
              <div className="sm:col-span-2">
                <Label
                  htmlFor="contact_name"
                  className="kinetic-label text-xs uppercase tracking-widest"
                >
                  Primary contact name
                </Label>
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  className={KINETIC_INPUT}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step === 2 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="kinetic-press h-11 rounded-none border-[3px] border-ink bg-card font-display text-sm font-extrabold uppercase tracking-wider shadow-hard hover:bg-amber hover:text-amber-foreground"
              >
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                asChild
                className="kinetic-label text-xs uppercase tracking-widest text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                <Link to="/">Cancel</Link>
              </Button>
            )}
            {step === 1 ? (
              <Button
                type="button"
                onClick={() => {
                  const parsed = registerHotelSchema.safeParse(buildPayload());
                  if (!parsed.success) {
                    setErrors(zodFieldErrors(parsed.error));
                    toast.error("Please fix the highlighted fields.");
                    return;
                  }
                  setErrors({});
                  setStep(2);
                }}
                className="kinetic-press h-11 rounded-none bg-primary font-display text-sm font-extrabold uppercase tracking-wider text-primary-foreground shadow-hard hover:bg-primary/90"
              >
                Next: Operations
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading}
                className="kinetic-press h-11 rounded-none bg-ink font-display text-sm font-extrabold uppercase tracking-wider text-background shadow-hard hover:bg-ink/85"
              >
                {loading ? "Submitting..." : "Submit registration"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
