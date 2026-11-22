import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Contours } from "@/components/contours";
import { PostJobForm } from "@/components/abroad/post-job-form";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Post a job abroad" };

export default async function NewAbroadJob() {
  const [user, { t }] = await Promise.all([requireUser("/abroad/jobs/new"), getDict()]);
  const f = t.abroadJobs.form;
  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={23} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pt-6 pb-8 sm:px-6">
          <Link href="/abroad?for=workers" className="btn btn-quiet -ml-2">
            <ArrowLeft size={16} aria-hidden /> {t.abroadJobs.back}
          </Link>
          <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">{f.title}</h1>
          <p className="text-muted mt-2 text-lg">{f.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        {user.roles.includes("client") ? (
          <PostJobForm />
        ) : (
          <p className="bg-surface-2 rounded-[12px] p-5">{f.recruitersOnly}</p>
        )}
      </div>
    </div>
  );
}
