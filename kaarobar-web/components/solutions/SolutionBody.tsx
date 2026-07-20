"use client";

import { Check } from "lucide-react";

import type { Solution } from "@/lib/solutions";

type SolutionBodyProps = {
  solution: Solution;
};

export default function SolutionBody({ solution }: SolutionBodyProps) {
  return (
    <section className="bg-bg-secondary py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold text-heading md:text-4xl">
            In practice
          </h2>
          <p className="mt-5 text-lg leading-8 text-body">{solution.summary}</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {solution.highlights.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-border bg-card p-8"
            >
              <h3 className="text-xl font-semibold text-heading">{item.title}</h3>
              <p className="mt-3 leading-7 text-body">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-border bg-card p-8 md:p-10">
          <h3 className="text-2xl font-bold text-heading">You’ll be able to</h3>
          <ul className="mt-6 space-y-4">
            {solution.outcomes.map((outcome) => (
              <li key={outcome} className="flex gap-3 text-body">
                <Check size={20} className="mt-0.5 shrink-0 text-success" />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
