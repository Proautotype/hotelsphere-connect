export type StaffRole =
  | "hotel_admin"
  | "manager"
  | "receptionist"
  | "cashier"
  | "accountant"
  | "housekeeping"
  | "restaurant"
  | "other";

/** Job titles a hotel owner can hand out. Never includes platform-team roles. */
export const STAFF_ROLE_OPTIONS: { value: StaffRole; label: string; blurb: string }[] = [
  {
    value: "hotel_admin",
    label: "Hotel admin",
    blurb: "Full control of this hotel, including its team",
  },
  { value: "manager", label: "Manager", blurb: "Runs day-to-day operations" },
  { value: "receptionist", label: "Receptionist", blurb: "Front desk, bookings, check-in/out" },
  { value: "cashier", label: "Cashier", blurb: "Takes payments and runs the cash drawer" },
  { value: "accountant", label: "Accountant", blurb: "Payments, refunds and reports" },
  { value: "housekeeping", label: "Housekeeping", blurb: "Room cleaning status" },
  { value: "restaurant", label: "Restaurant", blurb: "Services and food charges" },
  { value: "other", label: "Other", blurb: "Limited view-only access" },
];

export type PermissionKey =
  | "bookings:view"
  | "bookings:create"
  | "bookings:edit"
  | "bookings:cancel"
  | "bookings:check_in"
  | "bookings:check_out"
  | "rooms:view"
  | "rooms:manage"
  | "housekeeping:update"
  | "payments:record"
  | "payments:refund"
  | "cash_session:manage"
  | "finance:view"
  | "guests:view"
  | "guests:manage"
  | "staff:manage"
  | "services:manage"
  | "reports:view"
  | "hotel:settings"
  | "billing:view"
  | "data:manage";

export const PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: "bookings:view", label: "View bookings" },
  { key: "bookings:create", label: "Create bookings" },
  { key: "bookings:edit", label: "Edit bookings" },
  { key: "bookings:cancel", label: "Cancel bookings" },
  { key: "bookings:check_in", label: "Check in guests" },
  { key: "bookings:check_out", label: "Check out guests" },
  { key: "rooms:view", label: "View rooms" },
  { key: "rooms:manage", label: "Manage rooms" },
  { key: "housekeeping:update", label: "Update housekeeping" },
  { key: "payments:record", label: "Record payments" },
  { key: "payments:refund", label: "Refund payments" },
  { key: "cash_session:manage", label: "Manage cash sessions" },
  { key: "finance:view", label: "View finances" },
  { key: "guests:view", label: "View guests" },
  { key: "guests:manage", label: "Manage guests" },
  { key: "staff:manage", label: "Manage staff" },
  { key: "services:manage", label: "Manage services" },
  { key: "reports:view", label: "View reports" },
  { key: "hotel:settings", label: "Hotel settings" },
  { key: "billing:view", label: "View plan & invoices" },
  { key: "data:manage", label: "Export & manage hotel data" },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  hotel_admin: ALL_PERMISSIONS,
  manager: [
    "bookings:view",
    "bookings:create",
    "bookings:edit",
    "bookings:cancel",
    "bookings:check_in",
    "bookings:check_out",
    "rooms:view",
    "rooms:manage",
    "housekeeping:update",
    "payments:record",
    "payments:refund",
    "cash_session:manage",
    "finance:view",
    "guests:view",
    "guests:manage",
    "staff:manage",
    "services:manage",
    "reports:view",
    "hotel:settings",
    "billing:view",
  ],
  receptionist: [
    "bookings:view",
    "bookings:create",
    "bookings:edit",
    "bookings:check_in",
    "bookings:check_out",
    "rooms:view",
    "guests:view",
    "guests:manage",
  ],
  cashier: ["payments:record", "cash_session:manage", "finance:view", "bookings:view"],
  accountant: [
    "payments:record",
    "payments:refund",
    "cash_session:manage",
    "finance:view",
    "reports:view",
    "bookings:view",
  ],
  housekeeping: ["rooms:view", "housekeeping:update"],
  restaurant: ["services:manage", "bookings:view"],
  other: ["bookings:view", "rooms:view"],
};

export const HOTEL_TYPES = [
  "hotel",
  "guesthouse",
  "bnb",
  "apartment",
  "hostel",
  "resort",
  "boutique",
  "other",
];

export const ROOM_STATUSES = [
  "available",
  "reserved",
  "occupied",
  "cleaning",
  "dirty",
  "inspected",
  "maintenance",
  "out_of_service",
];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
];

export const FOLIO_CATEGORIES = [
  "accommodation",
  "food",
  "drink",
  "laundry",
  "spa",
  "transport",
  "extra",
  "tax",
  "discount",
  "refund",
];
