export type Program = "latam" | "azul" | "smiles";
export type JobStatus = "queued" | "running" | "completed" | "partial" | "attention_required" | "failed" | "cancelled";
export type MilePrices = Record<Program, number>;

export interface SearchInput {
  origin: string;
  destination: string;
  alternatives: string[];
  departure: string;
  returnDate: string | null;
  tripType: "oneway" | "roundtrip";
  adults: number;
  cabin: "economy" | "premium_economy" | "business" | "first";
  baggage: "carry_on" | "checked_23kg";
  flexDays: number;
  programs: Program[];
  milePrices: MilePrices;
  notes: string;
}

export interface Offer {
  id: string;
  program: Program;
  operator: string;
  origin: string;
  destination: string;
  departure: string;
  returnDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  durationMinutes: number | null;
  flights: string[];
  points: number;
  cashRequired: number | null;
  currency: string;
  taxesVerified: boolean;
  baggage: string;
  eligibility: string;
  source: string;
  checkedAt: string | null;
  caveat: string;
}

export interface Coverage {
  program: Program;
  origin: string;
  destination: string;
  departure: string;
  returnDate: string | null;
  state: "observed" | "no_results" | "technical_error" | "attention_required" | "not_completed";
  note: string;
  source: string;
  checkedAt: string | null;
}

export interface ResearchResult {
  summary: string;
  offers: Offer[];
  coverage: Coverage[];
  attention: string[];
}

export interface ResearchJob {
  resultAvailable?: boolean;
  offerCount?: number;
  coverageCompleted?: number;
  coverageExpected?: number;
  id: string;
  input: SearchInput;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  attempts: number;
  result: ResearchResult | null;
  monitorId: string | null;
}

export interface Monitor {
  id: string;
  input: SearchInput;
  enabled: boolean;
  targetCost: number;
  intervalHours: number;
  nextRunAt: string;
  lastJobId: string;
}

export interface PlatformNotification {
  id: string;
  jobId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface RobotStatus {
  id: string | null;
  lastSeenAt: string | null;
  online: boolean;
  currentJobId: string | null;
  version: string | null;
}

export interface Dashboard {
  jobs: ResearchJob[];
  settings: { milePrices: MilePrices };
  robot: RobotStatus;
  monitors: Monitor[];
  notifications: PlatformNotification[];
  now: string;
  storage: "postgres" | "local";
}
