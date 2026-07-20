import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

export default function CareersPage() {
  return (
    <section className="bg-bg-primary py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Careers
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading md:text-5xl">
          Want to help build Kaarobar?
        </h1>
        <p className="mt-5 text-lg leading-8 text-body">
          We’re a small team growing carefully. If you care about retail software
          that treats books and branches seriously, say hello.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link href={routes.contact} size="lg">
            Get in touch
          </Link>
          <Link href={routes.about} variant="outline" size="lg">
            About Kaarobar
          </Link>
        </div>
      </div>
    </section>
  );
}
