import { ApiError, autoflex } from "./api";
import { customerSessionId } from "./session";
import type { BookingInput } from "../domain/client";
import type { ApiBooking } from "../domain/api-types";
type Attempt = { key: string; input: BookingInput };
const storageKey = () => `af_booking_attempt:${customerSessionId()}`;
export function clearBookingAttempt() {
  sessionStorage.removeItem(storageKey());
}
export function readBookingAttempt(): Attempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(storageKey()) ?? "null",
    ) as Attempt | null;
    if (
      value &&
      typeof value.key === "string" &&
      /^[\w.:-]{8,128}$/.test(value.key) &&
      value.input &&
      typeof value.input === "object" &&
      typeof value.input.serviceCenterId === "string" &&
      typeof value.input.vehicleId === "string" &&
      typeof value.input.slotStart === "string" &&
      typeof value.input.slotEnd === "string"
    )
      return value;
  } catch {
    /* Ignore damaged browser data. */
  }
  clearBookingAttempt();
  return null;
}
export async function reserveBooking(input: BookingInput): Promise<ApiBooking> {
  const stored = readBookingAttempt();
  if (stored && JSON.stringify(stored.input) !== JSON.stringify(input))
    throw new ApiError(
      409,
      "Check your previous booking result before starting a different booking.",
      "BOOKING_ATTEMPT_PENDING",
    );
  const attempt = stored ?? { key: crypto.randomUUID(), input };
  // If storage is unavailable, stop before sending an unrecoverable reservation.
  sessionStorage.setItem(storageKey(), JSON.stringify(attempt));
  try {
    return await autoflex<ApiBooking>(
      "/v1/bookings",
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Idempotency-Key": attempt.key },
        body: JSON.stringify({
          ...attempt.input,
          mode: "SELF_CHECKIN",
          paymentMode: "PAY_AT_CENTER",
        }),
      },
      true,
    );
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status >= 400 &&
      err.status < 500 &&
      ![408, 429].includes(err.status)
    )
      clearBookingAttempt();
    throw err;
  }
}
