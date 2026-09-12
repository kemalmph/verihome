export type BookingType    = "short_stay" | "long_term" | "viewing";
export type BookingStatus  = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus  = "unpaid" | "pending_verification" | "paid" | "refunded";
export type RentalMode     = "long_term" | "short_stay" | "both";

export interface Booking {
  id:                 string;
  booking_code:       string;
  property_id:        string;
  user_id:            string;
  booking_type:       BookingType;
  check_in_date:      string;   // ISO date YYYY-MM-DD
  check_out_date:     string;
  nights:             number;
  guests:             number;
  price_per_night:    number;
  cleaning_fee:       number;
  total_price:        number;
  status:             BookingStatus;
  payment_status:     PaymentStatus;
  payment_provider:   string;
  bank_transfer_code: string | null;
  payment_proof_url:  string | null;
  admin_notes:        string | null;
  confirmed_at:       string | null;
  cancelled_at:       string | null;
  created_at:         string;
  updated_at:         string;
}

export interface ShortStayRate {
  id:                      string;
  property_id:             string;
  price_per_night:         number;
  price_per_night_weekend: number | null;
  min_nights:              number;
  max_nights:              number | null;
  cleaning_fee:            number;
  active:                  boolean;
}

export interface AvailabilityBlock {
  id:          string;
  property_id: string;
  start_date:  string;
  end_date:    string;
  reason:      "booked" | "maintenance" | "owner_use" | "other";
  booking_id:  string | null;
}

export interface UserCredit {
  id:         string;
  user_id:    string;
  amount:     number;
  reason:     string;
  viewing_id: string | null;
  created_at: string;
}

// ── Enriched types for UI ─────────────────────────────────────

export interface BookingWithProperty extends Booking {
  property: {
    id:   string;
    name: string;
    area: string;
    slug: string;
  };
}

export interface BookingWithUser extends Booking {
  user: {
    id:    string;
    name:  string;
    email: string;
    phone_whatsapp: string | null;
  };
}
