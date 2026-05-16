export type ContactChannel = "sms" | "email" | "phone";
export { scenarioTranscripts, type TranscriptTurn } from "./transcripts";
export type TicketStatus = "open" | "triaged" | "scheduled" | "cancelled" | "resolved";
export type WorkOrderStatus = "proposed" | "scheduled" | "cancelled" | "complete";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  preferredContact: ContactChannel;
  notes: string;
  accountStatus: "active" | "past_due" | "vip";
}

export interface Asset {
  assetId: string;
  customerId: string;
  productModel: string;
  installDate: string;
  warrantyExpiration: string;
  firmwareVersion: string;
  siteAddress: string;
  status: "online" | "offline" | "warning" | "service_required";
}

export interface TelemetryPoint {
  timestamp: string;
  assetId: string;
  voltage: number;
  amperage: number;
  errorCode: string | null;
  faultType: string | null;
  temperatureF: number;
  firmwareWarnings: string[];
  connectivityStatus: "online" | "intermittent" | "offline";
}

export interface ServiceHistoryEntry {
  historyId: string;
  customerId: string;
  assetId: string;
  date: string; summary: string; outcome: string;
}

export interface KnownIssuePattern {
  patternId: string;
  productModel: string;
  symptoms: string[];
  likelyPartId: string;
  confidence: "low" | "medium" | "high"; summary: string;
}

export interface InternalNote {
  noteId: string;
  ticketId: string;
  body: string; createdAt: string;
}

export interface Ticket {
  ticketId: string;
  customerId: string;
  assetId: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high" | "urgent";
  summary: string;
  notes: string[];
  linkedWorkOrderId?: string;
}

export interface Technician {
  techId: string;
  name: string;
  certifications: string[];
  region: string;
  schedule: AppointmentWindow[];
  vanInventory: string[];
}

export interface AppointmentWindow {
  windowId: string;
  date: string;
  start: string;
  end: string;
  available: boolean;
}

export interface InventoryItem {
  partId: string;
  partName: string;
  compatibleProducts: string[];
  quantity: number;
  location: string;
}

export interface Policy {
  policyId: string;
  title: string;
  summary: string;
  rules: string[];
}

export interface WorkOrder {
  workOrderId: string;
  ticketId: string;
  technicianId: string;
  appointmentWindow: AppointmentWindow;
  reservedParts: string[];
  customerChargeCents: number;
  status: WorkOrderStatus;
}

export interface CustomerMessage {
  messageId: string;
  customerId: string;
  channel: ContactChannel;
  body: string;
  status: "draft" | "saved" | "sent";
  createdAt: string;
  sentAt?: string;
}

export interface CaseSummary {
  summaryId: string;
  ticketId: string;
  body: string;
  createdAt: string;
}

export interface Approval {
  approvalId: string;
  token: string;
  action: string;
  summary: string;
  payload: unknown;
  status: ApprovalStatus;
  createdAt: string;
}

export interface EventLogEntry {
  eventId: string;
  timestamp: string;
  agentName: string;
  type:
    | "heard_entity"
    | "confirmation"
    | "tool_call"
    | "tool_result"
    | "handoff"
    | "guardrail"
    | "approval"
    | "state_change"
    | "failure"
    | "summary";
  label: string;
  toolName?: string;
  handoffTarget?: string;
  args?: Record<string, unknown>;
  resultSummary?: string;
  approvalStatus?: ApprovalStatus;
  error?: string;
}

export interface CompanyState {
  customers: Customer[];
  assets: Asset[];
  telemetry: TelemetryPoint[];
  serviceHistory: ServiceHistoryEntry[];
  knownIssuePatterns: KnownIssuePattern[];
  tickets: Ticket[];
  technicians: Technician[];
  inventory: InventoryItem[];
  policies: Policy[];
  workOrders: WorkOrder[];
  customerMessages: CustomerMessage[];
  internalNotes: InternalNote[];
  caseSummaries: CaseSummary[];
  approvals: Approval[];
  events: EventLogEntry[];
}

export interface DemoScenario {
  id: string;
  name: string;
  summary: string;
  openingPrompt: string;
  primaryCustomerId?: string;
  primaryAssetId?: string;
}

const tomorrow = "2026-05-17";

export const scenarios: DemoScenario[] = [
  {
    id: "dead-charger-outage",
    name: "Dead charger after outage",
    summary: "Amelia Brooks has CHG-8821 offline after a power outage. Warranty active; likely PCB-48A-R3.",
    openingPrompt:
      "Customer Amelia Brooks says charger C H G dash 8821 died after a power outage. Check warranty, recent telemetry, likely fix, and earliest certified tech with the right part.",
    primaryCustomerId: "cus_amelia_brooks",
    primaryAssetId: "CHG-8821"
  },
  {
    id: "refund-cancellation",
    name: "Refund and cancellation guardrail",
    summary: "Cancellation and deposit refund must pause for explicit confirmation plus UI approval.",
    openingPrompt: "Cancel tomorrow's install and refund the deposit.",
    primaryCustomerId: "cus_noah_reed",
    primaryAssetId: "BAT-4108"
  },
  {
    id: "unclear-asset-id",
    name: "Unclear audio / exact ID recovery",
    summary: "Partial spoken asset IDs must not trigger lookup until the normalized ID is confirmed.",
    openingPrompt: "Look up charger C H G eight... no, wait..."
  },
  {
    id: "ambiguous-customer",
    name: "Ambiguous customer",
    summary: "Multiple Amelia records force the agent to ask for one disambiguating detail before continuing.",
    openingPrompt: "Pull up Amelia and check her charger issue."
  },
  {
    id: "warranty-expired",
    name: "Warranty expired",
    summary: "Maya Chen's battery asset is out of warranty, so the agent must estimate charges before scheduling.",
    openingPrompt: "Maya Chen's BAT-7712 is tripping again. Check warranty before proposing dispatch.",
    primaryCustomerId: "cus_maya_chen",
    primaryAssetId: "BAT-7712"
  },
  {
    id: "part-out-of-stock",
    name: "Part out of stock",
    summary: "The diagnostic path finds the needed inverter module but local stock is zero.",
    openingPrompt: "Maya Chen's battery gateway keeps tripping. Check telemetry and schedule service if we have the part.",
    primaryCustomerId: "cus_maya_chen",
    primaryAssetId: "BAT-7712"
  },
  {
    id: "tool-failure-retry-once",
    name: "Tool failure retry once",
    summary: "Unknown asset lookup fails once; the agent should report the failure and ask for corrected ID instead of inventing data.",
    openingPrompt: "Check charger CHG-0000 and retry if the lookup fails."
  }
];

export function createSeedState(): CompanyState {
  const state: CompanyState = {
    customers: [
      {
        id: "cus_amelia_brooks",
        name: "Amelia Brooks",
        phone: "+1-805-555-0147",
        email: "amelia.brooks@example.test",
        address: "1417 Cedar Lane, Santa Barbara, CA",
        preferredContact: "sms",
        notes: "Prefers morning appointments. Gate code in service notes.",
        accountStatus: "vip"
      },
      {
        id: "cus_noah_reed",
        name: "Noah Reed",
        phone: "+1-805-555-0199",
        email: "noah.reed@example.test",
        address: "88 W Micheltorena St, Santa Barbara, CA",
        preferredContact: "email",
        notes: "Install deposit paid; cancellation window closes at 5 PM.",
        accountStatus: "active"
      },
      {
        id: "cus_maya_chen",
        name: "Maya Chen",
        phone: "+1-805-555-0182",
        email: "maya.chen@example.test",
        address: "422 Mesa Verde Dr, Santa Barbara, CA",
        preferredContact: "sms",
        notes: "Battery backup supports medical refrigeration.",
        accountStatus: "active"
      },
      {
        id: "cus_amelia_brown",
        name: "Amelia Brown",
        phone: "+1-805-555-0120",
        email: "amelia.brown@example.test",
        address: "50 Anacapa St, Santa Barbara, CA",
        preferredContact: "phone",
        notes: "Name collision fixture for ambiguous lookup.",
        accountStatus: "active"
      }
    ],
    assets: [
      {
        assetId: "CHG-8821",
        customerId: "cus_amelia_brooks",
        productModel: "AlpineCharge Pro 48A",
        installDate: "2025-06-20",
        warrantyExpiration: "2027-06-20",
        firmwareVersion: "4.8.13",
        siteAddress: "1417 Cedar Lane, Santa Barbara, CA",
        status: "service_required"
      },
      {
        assetId: "BAT-4108",
        customerId: "cus_noah_reed",
        productModel: "AlpineVault Home 13",
        installDate: "2026-05-17",
        warrantyExpiration: "2028-05-17",
        firmwareVersion: "2.3.1",
        siteAddress: "88 W Micheltorena St, Santa Barbara, CA",
        status: "online"
      },
      {
        assetId: "BAT-7712",
        customerId: "cus_maya_chen",
        productModel: "AlpineVault Home 20",
        installDate: "2024-03-09",
        warrantyExpiration: "2026-03-09",
        firmwareVersion: "2.1.9",
        siteAddress: "422 Mesa Verde Dr, Santa Barbara, CA",
        status: "warning"
      }
    ],
    telemetry: [
      {
        timestamp: "2026-05-16T07:45:00-07:00",
        assetId: "CHG-8821",
        voltage: 239,
        amperage: 0,
        errorCode: "GF-RESET-LOOP",
        faultType: "ground_fault_reset",
        temperatureF: 92,
        firmwareWarnings: ["post_outage_control_board_check", "relay_cycle_limit_near"],
        connectivityStatus: "intermittent"
      },
      {
        timestamp: "2026-05-16T08:00:00-07:00",
        assetId: "CHG-8821",
        voltage: 91,
        amperage: 0,
        errorCode: "VOLT-DROP",
        faultType: "voltage_drop",
        temperatureF: 94,
        firmwareWarnings: ["ground_fault_reset_repeated"],
        connectivityStatus: "offline"
      },
      {
        timestamp: "2026-05-16T06:30:00-07:00",
        assetId: "BAT-7712",
        voltage: 51,
        amperage: 8,
        errorCode: "INV-THERM",
        faultType: "inverter_thermal_trip",
        temperatureF: 118,
        firmwareWarnings: ["cooling_derate"],
        connectivityStatus: "online"
      }
    ],
    serviceHistory: [
      {
        historyId: "hist_amelia_install",
        customerId: "cus_amelia_brooks",
        assetId: "CHG-8821",
        date: "2025-06-20",
        summary: "Installed AlpineCharge Pro 48A with dedicated breaker.",
        outcome: "Passed commissioning tests; no follow-up required."
      },
      {
        historyId: "hist_maya_trip",
        customerId: "cus_maya_chen",
        assetId: "BAT-7712",
        date: "2026-02-11",
        summary: "Investigated battery gateway thermal trip.",
        outcome: "Cleaned intake and advised inverter module replacement if trip recurs."
      }
    ],
    knownIssuePatterns: [
      {
        patternId: "issue_chg_outage_pcb",
        productModel: "AlpineCharge Pro 48A",
        symptoms: ["voltage_drop", "ground_fault_reset", "post_outage_control_board_check"],
        likelyPartId: "PCB-48A-R3",
        confidence: "high",
        summary: "Post-outage reset loop on 48A chargers usually indicates control-board failure."
      },
      {
        patternId: "issue_bat_inverter_thermal",
        productModel: "AlpineVault Home 20",
        symptoms: ["inverter_thermal_trip", "cooling_derate"],
        likelyPartId: "INV-HOME20-R2",
        confidence: "medium",
        summary: "Repeated thermal trips point to inverter module replacement after airflow check."
      }
    ],
    tickets: [
      {
        ticketId: "TCK-1044",
        customerId: "cus_amelia_brooks",
        assetId: "CHG-8821",
        status: "open",
        priority: "high",
        summary: "Charger offline after utility outage",
        notes: ["Customer reports breaker reset did not recover charger."]
      },
      {
        ticketId: "TCK-1048",
        customerId: "cus_noah_reed",
        assetId: "BAT-4108",
        status: "open",
        priority: "normal",
        summary: "Tomorrow install pending",
        notes: ["Deposit paid. Crew assigned but not dispatched."]
      }
    ],
    technicians: [
      {
        techId: "tech_marco_diaz",
        name: "Marco Diaz",
        certifications: ["charger_service", "battery_storage", "pcb_replacement"],
        region: "Santa Barbara",
        vanInventory: ["PCB-48A-R3"],
        schedule: [
          { windowId: "win_marco_1012", date: tomorrow, start: "10:00", end: "12:00", available: true },
          { windowId: "win_marco_1416", date: tomorrow, start: "14:00", end: "16:00", available: true }
        ]
      },
      {
        techId: "tech_iris_patel",
        name: "Iris Patel",
        certifications: ["battery_storage", "inverter_service"],
        region: "Santa Barbara",
        vanInventory: [],
        schedule: [
          { windowId: "win_iris_1214", date: tomorrow, start: "12:00", end: "14:00", available: true }
        ]
      }
    ],
    inventory: [
      {
        partId: "PCB-48A-R3",
        partName: "Control board, AlpineCharge Pro 48A R3",
        compatibleProducts: ["AlpineCharge Pro 48A"],
        quantity: 2,
        location: "Santa Barbara service cage"
      },
      {
        partId: "INV-HOME20-R2",
        partName: "Inverter module, AlpineVault Home 20 R2",
        compatibleProducts: ["AlpineVault Home 20"],
        quantity: 0,
        location: "Ventura warehouse"
      }
    ],
    policies: [
      {
        policyId: "warranty-standard",
        title: "Residential hardware warranty",
        summary: "Parts and labor covered for active warranty assets when telemetry supports hardware failure.",
        rules: ["Verify asset ID exactly.", "Confirm customer identity.", "No customer charge while warranty is active."]
      },
      {
        policyId: "cancellation-refund",
        title: "Install cancellation and deposit refund",
        summary: "Cancellation and deposit refunds require explicit customer confirmation and supervisor approval.",
        rules: ["Explain install-slot release.", "Do not mark refunded until createCreditMemo succeeds.", "Approval token required."]
      }
    ],
    workOrders: [],
    customerMessages: [],
    internalNotes: [],
    caseSummaries: [],
    approvals: [],
    events: []
  };

  state.events.push(event("Realtime Triage Agent", "summary", "Scenario seed loaded"));
  return state;
}

export function event(
  agentName: EventLogEntry["agentName"],
  type: EventLogEntry["type"],
  label: string,
  partial: Partial<EventLogEntry> = {}
): EventLogEntry {
  return {
    eventId: `evt_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    agentName,
    type,
    label,
    ...partial
  };
}

export function getScenario(id: string): DemoScenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}
