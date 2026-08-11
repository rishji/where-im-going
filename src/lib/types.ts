export type ConfirmationStatus = "planned" | "tentative" | "confirmed" | "booked";
export type TripSource = "google_calendar" | "google_sheet" | "calendar_sync" | "manual";
export type Visibility = "public" | "private";

export interface Trip {
  id: string;
  user_id: string;

  date_from: string;
  date_to: string;

  location_name: string;
  location_label: string | null;
  city: string | null;
  region: string | null;
  country: string | null;

  lat: number | null;
  lng: number | null;

  event_name: string | null;
  flights: string | null;

  confirmation_status: ConfirmationStatus;
  source: TripSource;
  visibility: Visibility;

  created_at: string;
  updated_at: string;
}

export interface TripParticipant {
  trip_id: string;
  user_id: string;
  visibility: Visibility;
  added_at: string;
}

export interface TripNote {
  id: string;
  trip_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string;
  public_slug: string | null;
  public_page_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: "google";
  calendar_id: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
