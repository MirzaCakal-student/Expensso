"use client";

import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/image-client";

type Message = { role: "user" | "assistant"; text: string; image?: string };

const STARTERS = [
  "Where did most of my money go this month?",
  "What could I cut back on without missing it?",
  "Is my spending this month higher than usual?",
];

export function ChatClient({ enabled }: { enabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  async function send(override?: string) {
    const content = (override ?? text).trim();
    if (busy || (!content && !image)) return;
    const next: Message[] = [...messages, { role: "user", text: content, image: image ?? undefined }];
    setMessages(next);
    setText("");
    setImage(null);
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The AI could not answer. Try again.");
      setMessages([...next, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI could not answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await fileToDataUrl(file, 1280));
    } catch {
      setError("That file is not a usable photo.");
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl bg-card p-5">
        <h2 className="font-display text-lg font-semibold">The AI is not set up yet</h2>
        <p className="mt-2 text-muted">
          Add AI_API_KEY to the .env.local file in the app folder and restart the app. The README
          explains how to get a free key.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="rounded-2xl bg-card p-5">
            <p className="text-muted">
              Ask about your spending, or send a photo of something you are thinking of buying and
              ask whether it is worth it.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-left text-sm hover:border-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user" ? "self-end bg-ink text-white" : "self-start bg-card"
              }`}
            >
              {m.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="Photo you sent" className="mb-2 max-h-64 rounded-xl" />
              )}
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </li>
          ))}
          {busy && <li className="self-start rounded-2xl bg-card px-4 py-3 text-muted">Thinking…</li>}
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-alert">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mb-4 rounded-2xl bg-card p-2"
      >
        {image && (
          <div className="flex items-center gap-3 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Photo to send" className="h-16 w-16 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="cursor-pointer text-sm font-medium text-muted hover:text-ink"
            >
              Remove photo
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn shrink-0 px-3"
            aria-label="Add a photo"
          >
            Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Ask about your money"
            aria-label="Message"
            className="max-h-40 min-h-[2.9rem] flex-1 resize-none bg-transparent px-2 py-2.5 outline-none"
          />
          <button className="btn btn-primary shrink-0" disabled={busy || (!text.trim() && !image)}>
            Send
          </button>
        </div>
      </form>
    </>
  );
}
