import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";

type InfoPageContent = {
  kicker: string;
  title: string;
  intro: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
  action?: {
    label: string;
    href: string;
  };
};

const pages: Record<string, InfoPageContent> = {
  "/help": {
    kicker: "Support",
    title: "Help Center",
    intro:
      "Get unstuck with room search, booking requests, owner workflows, and account access.",
    sections: [
      {
        title: "Students",
        body: "Use map or list search, open a listing, choose dates, and send a booking request from the listing detail page.",
      },
      {
        title: "Owners",
        body: "Open the dashboard with an Owner account to submit listing drafts, review requests, update booking states, and manage lease documents.",
      },
      {
        title: "Accounts",
        body: "Use the Account button in the header to sign in or create a Student or Owner profile.",
      },
    ],
    action: { label: "Open Dashboard", href: "/dashboard" },
  },
  "/contact": {
    kicker: "Support",
    title: "Contact",
    intro:
      "Reach the Sabai Stay team for listing review, student booking support, and account issues.",
    sections: [
      {
        title: "Email",
        body: "support@sabaistay.example",
      },
      {
        title: "Campus Area",
        body: "Pathum Thani, Thailand. Primary coverage starts around Rangsit University.",
      },
      {
        title: "Response Window",
        body: "Operational requests are triaged by booking status, listing ownership, and active contract state.",
      },
    ],
    action: { label: "Browse Rooms", href: "/list" },
  },
  "/faq": {
    kicker: "Support",
    title: "FAQ",
    intro:
      "Common questions for student housing search, owner listings, bookings, and contracts.",
    sections: [
      {
        title: "Can students book directly?",
        body: "Students send a booking request first. Owners approve, reject, or move approved requests into deposit pending and confirmed states.",
      },
      {
        title: "How do listings go live?",
        body: "Owners submit drafts. Drafts can be managed in the owner dashboard and are kept separate from archived listings.",
      },
      {
        title: "Where are contracts handled?",
        body: "Contracts appear in the dashboard after the booking workflow creates or updates the lease record.",
      },
    ],
    action: { label: "View Map", href: "/" },
  },
  "/privacy": {
    kicker: "Legal",
    title: "Privacy",
    intro:
      "Sabai Stay uses account and booking information only to operate student housing workflows.",
    sections: [
      {
        title: "Account Data",
        body: "Profiles store role, contact, and verification-related fields needed for student and owner access.",
      },
      {
        title: "Housing Activity",
        body: "Listings, booking requests, contracts, reviews, notifications, and roommate profile data are scoped to the relevant user roles.",
      },
      {
        title: "Uploads",
        body: "Listing images and contract documents use signed upload URLs so files are linked to the intended listing or contract workflow.",
      },
    ],
  },
  "/terms": {
    kicker: "Legal",
    title: "Terms",
    intro:
      "Use Sabai Stay for legitimate student housing discovery, booking, and owner portfolio management.",
    sections: [
      {
        title: "Student Use",
        body: "Students are responsible for accurate booking details, contact information, and lease intent.",
      },
      {
        title: "Owner Use",
        body: "Owners are responsible for accurate listing details, lawful rental terms, document uploads, and timely request handling.",
      },
      {
        title: "Platform Scope",
        body: "Sabai Stay coordinates discovery and workflow state. Final rental commitments remain between students and property owners.",
      },
    ],
  },
};

export default function InfoPage() {
  const [location] = useLocation();
  const content = pages[location] ?? pages["/help"];

  return (
    <Layout>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
            {content.kicker}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase md:text-6xl">
            {content.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed opacity-70 md:text-lg">
            {content.intro}
          </p>
          {content.action ? (
            <Button asChild className="mt-6">
              <Link href={content.action.href}>{content.action.label}</Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {content.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-sm border p-5"
              style={{
                backgroundColor: "var(--color-card)",
                borderColor: "var(--color-border)",
              }}
            >
              <h2 className="font-display text-lg font-bold uppercase">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed opacity-70">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  );
}

