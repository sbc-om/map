"use client";

import { RideChat } from "@/components/taxi/RideChat";

// TEMP isolation test page for the in-ride chat. Two RideChat instances bound to
// the same rideId; a message sent in one must appear in the other.
export default function ChatTest() {
  const rideId = "ride_test_1";
  return (
    <div className="grid grid-cols-2 gap-6 bg-zinc-900 p-6">
      <div data-testid="passenger" className="rounded-xl bg-zinc-800 p-4">
        <p className="mb-2 text-white">Passenger view</p>
        <RideChat
          rideId={rideId}
          sender="passenger"
          senderName="Pat Passenger"
          peerName="Dan Driver"
        />
      </div>
      <div data-testid="driver" className="rounded-xl bg-zinc-800 p-4">
        <p className="mb-2 text-white">Driver view</p>
        <RideChat
          rideId={rideId}
          sender="driver"
          senderName="Dan Driver"
          peerName="Pat Passenger"
        />
      </div>
    </div>
  );
}
