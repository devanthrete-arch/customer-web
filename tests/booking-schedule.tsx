import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DomainProvider } from "../src/domain/DomainProvider";
import { customerApi, marketplaceApi } from "../src/domain/client";
import { BookScheduleScreen } from "../src/screens/BookingScreens";
import { patchDraft, clearDraft, getDraft } from "../src/lib/booking";
import { ApiError } from "../src/lib/api";
import {
  clearBookingAttempt,
  readBookingAttempt,
  reserveBooking,
} from "../src/lib/booking-attempt";
import type { ApiSlotDay } from "../src/domain/api-types";
import "../src/index.css";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const root = createRoot(document.getElementById("fixture")!);
const fixture = document.getElementById("fixture")!;
const original = {
  customer: { ...customerApi },
  marketplace: { ...marketplaceApi },
  fetch: window.fetch,
};
const stored = Object.entries(sessionStorage);
const results = document.getElementById("results")!;
function check(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
  const li = document.createElement("li");
  li.textContent = `PASS ${message}`;
  results.append(li);
}
const button = (text: string) =>
  [...fixture.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text),
  )!;
const click = async (element: HTMLElement) => {
  await act(async () => element.click());
};
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Kolkata",
});
const day: ApiSlotDay = {
  date: today,
  closed: false,
  firstDate: today,
  lastDate: today,
  leadMinutes: 0,
  scheduleRevision: 1,
  serverNow: new Date().toISOString(),
  timeZone: "Asia/Kolkata",
  slotMinutes: 60,
  slots: [
    {
      start: `${today}T10:00:00+05:30`,
      end: `${today}T11:00:00+05:30`,
      available: true,
      remaining: 1,
    },
  ],
};
async function run() {
  clearDraft();
  clearBookingAttempt();
  // Provider startup APIs are isolated from the live workshop.
  Object.assign(customerApi, {
    profile: async () => ({ id: "profile", displayName: "Tester" }),
    vehicles: async () => [
      {
        id: "vehicle",
        status: "ACTIVE",
        vehicleType: "TWO_WHEELER",
        make: "Honda",
        model: "Activa",
      },
    ],
    bookings: async () => [],
    jobs: async () => [],
    invoices: async () => [],
    documents: async () => [],
    maintenance: async () => [],
    notifications: async () => ({ items: [], unreadCount: 0 }),
    supportRequests: async () => [],
    addresses: async () => [],
    archivedDocuments: async () => [],
  });
  patchDraft({
    vehicleId: "vehicle",
    vehicleType: "TWO_WHEELER",
    centerId: "center",
    issueDescription: "Keep my notes",
  });
  marketplaceApi.slots = async () => {
    throw new ApiError(0, "Network unavailable");
  };
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={["/services/book/schedule"]}>
          <DomainProvider>
            <BookScheduleScreen />
          </DomainProvider>
        </MemoryRouter>
      </StrictMode>,
    ),
  );
  check(
    fixture.textContent?.includes("Network unavailable"),
    "shows availability failures and a retry action",
  );
  marketplaceApi.slots = async () => structuredClone(day);
  await click(button("Refresh availability"));
  check(
    !fixture.textContent?.includes("Network unavailable") &&
      fixture.querySelectorAll(".af-slot").length === 1,
    "successful retry clears old errors and restores slots",
  );
  await click(fixture.querySelector(".af-slot")!);
  check(
    !button("Review booking").disabled,
    "selecting a currently available slot enables review",
  );
  marketplaceApi.slots = async () => ({
    ...day,
    slots: day.slots.map((s) => ({ ...s, available: false, remaining: 0 })),
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  check(
    button("Review booking").disabled,
    "focus refresh invalidates a slot that filled",
  );
  check(
    getDraft().issueDescription === "Keep my notes",
    "slot refresh preserves issue notes",
  );
  await act(async () => root.render(null));
  const input = {
    serviceCenterId: "center",
    vehicleId: "vehicle",
    slotStart: day.slots[0].start,
    slotEnd: day.slots[0].end,
  };
  const calls: RequestInit[] = [];
  window.fetch = async (_url, init) => {
    calls.push(init!);
    throw new Error("Lost response");
  };
  await reserveBooking(input).catch(() => undefined);
  check(
    !!readBookingAttempt(),
    "an uncertain reservation keeps its recovery request",
  );
  window.fetch = async (_url, init) => {
    calls.push(init!);
    return new Response(JSON.stringify({ id: "booking" }), { status: 201 });
  };
  await reserveBooking(input);
  check(
    new Headers(calls[0].headers).get("Idempotency-Key") ===
      new Headers(calls[1].headers).get("Idempotency-Key") &&
      calls[0].body === calls[1].body,
    "booking retry sends the original key and body",
  );
  let denied = false;
  await reserveBooking({ ...input, vehicleId: "another" }).catch(() => {
    denied = true;
  });
  check(
    denied && calls.length === 2,
    "a different request cannot replace an unresolved booking",
  );
  clearBookingAttempt();
}
void run()
  .then(() => {
    document.getElementById("status")!.textContent =
      `${results.children.length} passed`;
  })
  .catch((error: unknown) => {
    document.getElementById("status")!.textContent = `FAIL ${String(error)}`;
    console.error(error);
  })
  .finally(() => {
    Object.assign(customerApi, original.customer);
    Object.assign(marketplaceApi, original.marketplace);
    window.fetch = original.fetch;
    sessionStorage.clear();
    for (const [key, value] of stored) sessionStorage.setItem(key, value);
  });
