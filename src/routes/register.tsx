import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registerHotel } from "@/lib/hotels.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register your hotel — Custard Hotels" },
      { name: "description", content: "Register your hotel, guest house, or serviced apartment on Custard Hotels." },
      { property: "og:title", content: "Register your hotel — Custard Hotels" },
      { property: "og:description", content: "Register your hotel, guest house, or serviced apartment on Custard Hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

const HOTEL_TYPES = ["Hotel", "Guest House", "Boutique Hotel", "Resort", "Serviced Apartment", "Motel", "Hostel", "Lodge", "Airbnb / Vacation Rental", "Conference Hotel"];

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

  const update = (key: keyof typeof form, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      navigate({ to: "/auth", search: { redirect: window.location.href } });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        slug: slugify(form.name),
        amenities: [] as string[],
        description: form.description || "",
      };
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
      <div className="flex min-h-screen items-center justify-center bg-sand px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold text-foreground">Sign in first</h1>
          <p className="mt-2 text-sm text-muted-foreground">You need an account to register a hotel.</p>
          <Button className="mt-4" asChild>
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
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Register your hotel</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tell us about your property. You can complete the rest after registration.</p>
        </div>

        <div className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className={step === 1 ? "text-primary" : ""}>1. Property</span>
          <span>/</span>
          <span className={step === 2 ? "text-primary" : ""}>2. Operations</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Hotel name</Label>
                <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => update("description", e.target.value)} />
              </div>
              <div>
                <Label>Property type</Label>
                <Select value={form.hotel_type} onValueChange={(v) => update("hotel_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOTEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="room_count">Number of rooms</Label>
                <Input id="room_count" type="number" min={0} value={form.room_count} onChange={(e) => update("room_count", parseInt(e.target.value || "0", 10))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <Input id="region" value={form.region} onChange={(e) => update("region", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => update("website", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">GHS — Ghana Cedi</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => update("timezone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Accra">Africa/Accra</SelectItem>
                    <SelectItem value="Africa/Lagos">Africa/Lagos</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="check_in_time">Check-in time</Label>
                <Input id="check_in_time" type="time" value={form.check_in_time} onChange={(e) => update("check_in_time", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="check_out_time">Check-out time</Label>
                <Input id="check_out_time" type="time" value={form.check_out_time} onChange={(e) => update("check_out_time", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="tax_percent">Tax %</Label>
                <Input id="tax_percent" type="number" step="0.01" value={form.tax_percent} onChange={(e) => update("tax_percent", parseFloat(e.target.value || "0"))} />
              </div>
              <div>
                <Label htmlFor="service_charge_percent">Service charge %</Label>
                <Input id="service_charge_percent" type="number" step="0.01" value={form.service_charge_percent} onChange={(e) => update("service_charge_percent", parseFloat(e.target.value || "0"))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="cancellation_policy">Cancellation policy</Label>
                <Textarea id="cancellation_policy" value={form.cancellation_policy} onChange={(e) => update("cancellation_policy", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="contact_name">Primary contact name</Label>
                <Input id="contact_name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step === 2 ? (
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="ghost" asChild>
                <Link to="/">Cancel</Link>
              </Button>
            )}
            {step === 1 ? (
              <Button type="button" onClick={() => setStep(2)}>
                Next: Operations
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit registration"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
