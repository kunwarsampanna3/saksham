import type { Metadata } from "next";
import { Suspense } from "react";
import { Chat } from "@/components/chat/chat";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const [, { t }] = await Promise.all([requireUser("/messages"), getDict()]);
  return (
    <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t.msg.title}</h1>
      <p className="text-muted mt-1 mb-5">{t.msg.lead}</p>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Chat />
      </Suspense>
    </div>
  );
}
