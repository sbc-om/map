"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, Send } from "lucide-react";
import { useMessages } from "@/hooks/useTaxiStore";
import { sendMessage } from "@/lib/taxi/actions";
import type { ChatSender } from "@/types/taxi";

interface RideChatProps {
  rideId: string;
  /** Who the local user is in this ride. */
  sender: ChatSender;
  /** Display name of the local user (stamped on outgoing messages). */
  senderName: string;
  /** Name of the other party, shown in empty/placeholder copy. */
  peerName: string;
  /** Other party's phone number; enables the call button when present. */
  peerMobile?: string | null;
  /** Disable composing once the ride is over. */
  disabled?: boolean;
}

/**
 * In-ride chat between the passenger and the driver. Messages flow through the
 * shared taxi store, so they sync across tabs locally and across devices when
 * Ably realtime is configured. A call button is shown when the other party
 * shared a phone number.
 */
export function RideChat({
  rideId,
  sender,
  senderName,
  peerName,
  peerMobile,
  disabled = false,
}: RideChatProps) {
  const messages = useMessages(rideId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text) return;
      sendMessage({ rideId, sender, senderName, text });
      setDraft("");
    },
    [draft, rideId, sender, senderName]
  );

  return (
    <div className="flex flex-col gap-2.5">
      {peerMobile && (
        <a
          href={`tel:${peerMobile}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20 active:scale-[0.98]"
        >
          <Phone className="h-4 w-4" />
          Call {peerName.split(" ")[0]}
        </a>
      )}

      {/* Message history */}
      <div
        ref={scrollRef}
        className="scrollbar-thin flex max-h-52 min-h-[4rem] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/20 p-2.5"
      >
        {messages.length === 0 ? (
          <p className="m-auto px-2 text-center text-xs text-white/35">
            No messages yet. Say hello to {peerName.split(" ")[0]}.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === sender;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
                    mine
                      ? "rounded-br-sm bg-amber-500 text-black"
                      : "rounded-bl-sm bg-white/10 text-white"
                  }`}
                >
                  {m.text}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-white/30">
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Chat closed" : "Type a message…"}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none disabled:opacity-50 sm:text-sm"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-black transition enabled:hover:bg-amber-400 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
