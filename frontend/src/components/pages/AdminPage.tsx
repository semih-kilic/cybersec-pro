"use client";

import dynamic from "next/dynamic";
import RevealOnScroll from "@/components/animations/RevealOnScroll";
const MatrixRain = dynamic(() => import("@/components/three/MatrixRain"), { ssr: false });
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <>
      <MatrixRain />
      <section className="flex min-h-[70vh] items-center justify-center px-6 pt-32 pb-28">
      <RevealOnScroll>
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[--color-red]/15">
            <ShieldAlert className="h-10 w-10 text-[--color-red]" />
          </div>
          <h1 className="text-4xl font-extrabold md:text-5xl">Admin Panel</h1>
          <p className="mt-4 text-lg text-white/55">
            The admin panel is available in the dashboard application. Please log in with your admin credentials.
          </p>
          <div className="mt-8">
            <Link href="/dashboard" className="btn-primary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </RevealOnScroll>
    </section>
    </>
  );
}
