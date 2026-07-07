import React from "react";
import Link from "next/link";

export default function Landing() {
  return (
    <section className="flex min-h-svh flex-col items-center justify-between px-[max(1rem,env(safe-area-inset-left))] pt-[max(0px,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <section className="container flex w-fit flex-col items-center justify-center gap-0">
          {/* <h1 className=" text-5xl text-left leading-none tracking-[0em] select-none text-black/80 font-black flex gap-2 flex-col">
           <div>   KS{" "}</div> 
            </h1> */}
          <h1 className="header-xl text-left font-[500] leading-none select-none logo-font text-ink-strong">
            <span className="mr-[0.03em]">K</span>EEPS
          </h1>
          {/* <h2 className="!mb-0 text-4xl text-black/90 font-bold" >A page for every day. </h2> */}
          <p className="text-lg text-ink-soft mt-2 body-font font-light">
            Plan, rant, dream, or just collect pretty things.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 mt-6">
            <Link href="/sign-in" className="text-sm transition-colors">
              <button className="button-secondary">Sign - Save My Vibes</button>
            </Link>
            <Link href="/dashboard">
              <button className="button-primary">Try Keeps Now ✨</button>
            </Link>
          </div>
        </section>
      </div>
      <p className="text-sm text-ink-muted mt-4 text-center">
        All your vibes stay on this device.{" "}
        <Link
          href="/sign-up"
          className="underline-offset-2 hover:underline text-ink hover:text-ink transition-colors"
        >
          Make an account
        </Link>{" "}
        when you’re ready to keep them safe everywhere.
      </p>
    </section>
  );
}
