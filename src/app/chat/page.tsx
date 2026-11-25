import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { ChatClient } from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requireUser();
  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <span className="font-display text-xl font-bold tracking-tight">Ask AI</span>
        <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-card">
          Back to overview
        </Link>
      </header>
      <ChatClient enabled={aiConfigured()} />
    </div>
  );
}
