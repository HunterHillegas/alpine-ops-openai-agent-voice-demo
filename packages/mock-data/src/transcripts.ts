export type TranscriptSpeaker = "dispatcher" | "assistant";

export interface TranscriptTurn {
  speaker: TranscriptSpeaker;
  text: string;
}

export const scenarioTranscripts: Record<string, TranscriptTurn[]> = {
  "dead-charger-outage": [
    {
      speaker: "dispatcher",
      text: "Customer Amelia Brooks says charger C H G dash 8821 died after a power outage. Check warranty, recent telemetry, likely fix, and earliest certified tech with the right part."
    },
    {
      speaker: "assistant",
      text: "I heard charger CHG-8821. Please confirm that exact asset ID before I look it up."
    },
    {
      speaker: "dispatcher",
      text: "Confirmed, CHG-8821."
    },
    {
      speaker: "assistant",
      text: "I found active warranty coverage, a likely control-board fault, local PCB-48A-R3 stock, and Marco Diaz available tomorrow 10:00 to 12:00. Approval is ready."
    }
  ],
  "refund-cancellation": [
    {
      speaker: "dispatcher",
      text: "Cancel tomorrow's install and refund the deposit."
    },
    {
      speaker: "assistant",
      text: "I can prepare the cancellation, but I need explicit approval before cancelling the appointment or creating a credit memo."
    }
  ],
  "unclear-asset-id": [
    {
      speaker: "dispatcher",
      text: "Look up charger C H G eight... no, wait..."
    },
    {
      speaker: "assistant",
      text: "I do not have the full asset ID yet. Please give the three letters and four digits again."
    }
  ]
};
