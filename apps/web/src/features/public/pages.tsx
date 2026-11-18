import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Globe2,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PageHeader, StatCard } from "@/components/common/page";
import { EmptyState, ErrorState, LoadingState, QueryState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import hero1024Webp from "@/assets/hero-1024.webp";
import hero640Webp from "@/assets/hero-640.webp";
import heroUrl from "@/assets/hero.jpg";
import { mediaUrl } from "@/lib/api/client";
import { startGuestSession } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { missionsApi } from "@/lib/api/missions";
import { catalogApi, countriesApi } from "@/lib/api/world";
import { useSessionStore } from "@/lib/auth/session-store";
import { titleCase } from "@/lib/format";
import { useCountries } from "@/lib/queries";
import { CountryCard, CountryFlag, MissionTitle, REGION_LABELS, TopicChips } from "./components";

const useCatalog = () =>
  useQuery({ queryKey: ["catalog"], queryFn: catalogApi.get, staleTime: 60_000 });

function PlayCta({ size = "lg" }: { size?: "lg" | "default" }) {
  const status = useSessionStore((s) => s.status);
  const navigate = useNavigate();
  const guest = useMutation({ mutationFn: startGuestSession, onSuccess: () => navigate("/play") });
  if (status === "authenticated") {
    return (
      <Button asChild size={size} variant="game">
        <Link to="/play">Continue playing</Link>
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button size={size} variant="game" loading={guest.isPending} onClick={() => guest.mutate()}>
        Start playing — free
      </Button>
      <Button asChild size={size} variant="outline">
        <Link to="/register">Create an account</Link>
      </Button>
      {guest.isError && <p className="text-sm text-destructive">{errorMessage(guest.error)}</p>}
    </div>
  );
}

export function LandingPage() {
  const catalog = useCatalog();
  const activeCountries = catalog.data?.countries.filter((c) => c.status === "active").length;
  return (
    <>
      <section className="adinkra-pattern border-b-2 border-foreground/10">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
          <div className="space-y-5">
            <Badge variant="accent">Clinical learning game for African health systems</Badge>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Save Lives.
              <br />
              <span className="text-primary">Build Healthier Nations.</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Step into clinics across Africa. Make the calls in real patient stories, run a
              hospital through emergencies, and get a personal learning debrief on your reasoning.
            </p>
            <PlayCta />
            <p className="text-sm text-muted-foreground">
              No sign-up needed to start. Every case is reviewed by a verified clinician.
            </p>
          </div>
          <div className="relative">
            {/* WebP at two widths (66 KB on phones instead of 207 KB); the original JPEG is the fallback. */}
            <picture>
              <source
                type="image/webp"
                srcSet={`${hero640Webp} 640w, ${hero1024Webp} 1024w`}
                sizes="(min-width: 768px) 50vw, 100vw"
              />
              <img
                src={heroUrl}
                width={1024}
                height={768}
                fetchPriority="high"
                decoding="async"
                alt="A nurse in teal scrubs standing outside a rural African clinic at sunset"
                className="aspect-[4/3] w-full rounded-3xl border-2 border-foreground object-cover shadow-pop"
              />
            </picture>
            <div className="absolute -bottom-4 left-4 rounded-2xl border-2 border-foreground bg-card px-4 py-2 font-display font-extrabold shadow-pop-sm">
              ❤️ Health Points · ₵ Funding · 🏥 Hospital levels
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-3xl font-extrabold">Four ways to play</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "📖",
              tone: "bg-primary text-primary-foreground",
              title: "Story Mode",
              text: "Follow patients and communities through cases that unlock as your hospital grows.",
            },
            {
              icon: "🩺",
              tone: "bg-secondary text-secondary-foreground",
              title: "Clinical Challenge",
              text: "Rapid-fire practice cases for students — no locks, pure learning.",
            },
            {
              icon: "🏥",
              tone: "bg-accent text-accent-foreground",
              title: "Hospital Commander",
              text: "Manage staff, beds, ambulances and supplies before the next emergency strikes.",
            },
            {
              icon: "🌍",
              tone: "bg-card",
              title: "Countries",
              text: "Expand across Africa and meet each country's health priorities.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`rounded-2xl border-2 border-foreground p-5 shadow-pop ${f.tone}`}
            >
              <div className="text-3xl" aria-hidden="true">
                {f.icon}
              </div>
              <h3 className="mt-2 text-xl font-extrabold">{f.title}</h3>
              <p className="mt-1 text-sm opacity-90">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Clinician-approved cases"
            value={catalog.data ? catalog.data.missions.length : "…"}
            icon={<CheckCircle2 className="size-4" />}
          />
          <StatCard
            label="Countries open to play"
            value={activeCountries ?? "…"}
            hint="Of all 54 African Union member states"
            icon={<Globe2 className="size-4" />}
          />
          <StatCard
            label="Hospital levels to reach"
            value={catalog.data ? catalog.data.tiers.length : "…"}
            icon={<Building2 className="size-4" />}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-secondary" /> Clinically governed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              No case reaches players until a verified clinician has checked the scenario, the
              treatment and its references.
            </p>
            <p>
              Any change to a case sends it back for review. Answer keys never leave our servers.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Personal AI debriefs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Write down your reasoning as you play. After the case, get feedback matched to your
              training level.
            </p>
            <p>
              Debriefs agree with the clinician-approved answers and only cite approved references.
              For education only — not medical advice.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start gap-4 rounded-3xl border-2 border-foreground bg-secondary p-8 text-secondary-foreground shadow-pop md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Your first patient is waiting.</h2>
            <p className="opacity-90">
              Start as a guest. Create an account any time to keep your progress.
            </p>
          </div>
          <PlayCta size="default" />
        </div>
      </section>
    </>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="About" title="Training for the clinics that need it most" />
      <div className="space-y-6 text-lg leading-relaxed">
        <p>
          Africa Health Quest is an educational game for nursing, medical, midwifery and pharmacy
          students, junior doctors and community health workers. Its cases are set in the clinics,
          communities and health systems of the African continent.
        </p>
        <p>
          Every decision is a teaching moment: the game explains why an answer is right or wrong,
          and an optional AI debrief responds to your own reasoning, at your level of training.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          {
            icon: <HeartPulse />,
            title: "Realistic cases",
            text: "Common presentations — fever in the rainy season, a difficult birth, cholera outbreaks — with the resource limits of real clinics.",
          },
          {
            icon: <ShieldCheck />,
            title: "Reviewed by clinicians",
            text: "Verified clinicians approve every version of every case. Content changes always need a fresh approval, and the full version history is kept.",
          },
          {
            icon: <Stethoscope />,
            title: "Built for learners",
            text: "Practice mode has no locks or penalties. Story mode rewards careful, safe decisions.",
          },
          {
            icon: <Globe2 />,
            title: "Pan-African",
            text: "All 54 African Union member states are part of the map, opened country by country as their content is ready.",
          },
        ].map((x) => (
          <Card key={x.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-primary">
                {x.icon} {x.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{x.text}</CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-10" flat>
        <CardHeader>
          <CardTitle>Safety and privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This is a learning tool. Nothing in the game is medical advice for a real patient —
            always follow your national guidelines and supervisors.
          </p>
          <p>
            Never enter information that could identify a real patient. AI debriefs send your case
            choices and written reasoning (not your name or email) to our AI provider, only after
            you agree.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function HowToPlayPage() {
  const catalog = useCatalog();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        eyebrow="How to play"
        title="From village clinic to referral hospital"
        description="Earn Health Points by treating patients well, spend funding wisely, and grow your hospital."
      />
      <ol className="space-y-4">
        {[
          {
            n: 1,
            title: "Read the patient's story",
            text: "Each case opens with a scenario. Read it carefully — the clues are in the details.",
          },
          {
            n: 2,
            title: "Make the call, step by step",
            text: "Choose what to do at each step. Optionally write your reasoning first: it powers your AI debrief.",
          },
          {
            n: 3,
            title: "Learn from every answer",
            text: "After each choice you see whether it was right and why. Some choices are flagged as dangerous — avoid them.",
          },
          {
            n: 4,
            title: "Save the patient, earn rewards",
            text: "Pass the case to earn Health Points (❤️) and funding (₵). Your first pass earns the most; replays earn a share of any improvement.",
          },
          {
            n: 5,
            title: "Grow your hospital",
            text: "Health Points raise your hospital level, unlocking harder cases and new countries.",
          },
          {
            n: 6,
            title: "Command the hospital",
            text: "Spend funding on staff, beds, ambulances and supplies, then face a random emergency. Covering each need earns HP and funding back.",
          },
        ].map((s) => (
          <li
            key={s.n}
            className="flex gap-4 rounded-2xl border-2 border-foreground bg-card p-5 shadow-pop-sm"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-accent font-display text-lg font-extrabold">
              {s.n}
            </span>
            <div>
              <h2 className="text-lg font-extrabold">{s.title}</h2>
              <p className="text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="mt-12 text-2xl font-extrabold">Hospital levels</h2>
      <QueryState query={catalog} loading={<LoadingState rows={2} />}>
        {(c) => (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {c.tiers.map((t) => (
                <div
                  key={t.key}
                  className="rounded-2xl border-2 border-foreground bg-card p-4 text-center"
                >
                  <div className="text-3xl" aria-hidden="true">
                    {t.icon}
                  </div>
                  <div className="font-display font-extrabold">{t.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.hpRequired === 0 ? "Starting level" : `${t.hpRequired} HP`}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Hospital Commander: each resource unit costs ₵{c.hospital.unitCost}; you can allocate
              up to {c.hospital.maxUnitsPerResource} of each resource per shift.
            </p>
          </>
        )}
      </QueryState>
      <div className="mt-10">
        <PlayCta />
      </div>
    </div>
  );
}

export function LearningPage() {
  const catalog = useCatalog();
  const [open, setOpen] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["mission", open],
    queryFn: () => missionsApi.detail(open!),
    enabled: Boolean(open),
  });
  const catalogMissions = catalog.data?.missions;
  const byTopic = useMemo(() => {
    const map = new Map<string, NonNullable<typeof catalogMissions>>();
    for (const m of catalogMissions ?? [])
      for (const t of m.topics.length ? m.topics : ["general"])
        map.set(t, [...(map.get(t) ?? []), m]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalogMissions]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="Learning"
        title="What you'll learn"
        description="Topics and learning objectives of the clinician-approved cases currently in the game."
      />
      <QueryState
        query={catalog}
        isEmpty={(c) => c.missions.length === 0}
        empty={
          <EmptyState
            icon="🩺"
            title="Cases are being reviewed"
            description="New cases appear here as soon as a clinician approves them."
          />
        }
      >
        {() => (
          <div className="space-y-8">
            {byTopic.map(([topic, missions]) => (
              <section key={topic}>
                <h2 className="mb-3 text-xl font-extrabold">{titleCase(topic)}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {missions.map((m) => (
                    <Card key={m.key} flat className="overflow-hidden">
                      <button
                        className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-muted/50"
                        aria-expanded={open === m.key}
                        onClick={() => setOpen(open === m.key ? null : m.key)}
                      >
                        <MissionTitle m={m} />
                        <Badge variant="muted">{m.stepCount} steps</Badge>
                      </button>
                      {open === m.key && (
                        <div className="border-t-2 border-foreground/10 p-4 text-sm">
                          {detail.isPending ? (
                            <LoadingState rows={1} />
                          ) : detail.isError ? (
                            <ErrorState error={detail.error} />
                          ) : detail.data ? (
                            <div className="space-y-3">
                              {detail.data.learningObjectives.length ? (
                                <ul className="list-disc space-y-1 pl-5">
                                  {detail.data.learningObjectives.map((o) => (
                                    <li key={o}>{o}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-muted-foreground">{detail.data.story}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Reviewed by {detail.data.verification.reviewerName} (
                                {detail.data.verification.credentials})
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryState>
      <Card className="mt-12" flat>
        <CardHeader>
          <CardTitle>Who is it for?</CardTitle>
          <CardDescription>
            Choose your level in your profile — AI debriefs adapt their depth to it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            "Nursing student",
            "Medical student",
            "Midwifery student",
            "Pharmacy student",
            "Intern / junior doctor",
            "Community health worker",
          ].map((l) => (
            <Badge key={l} variant="outline">
              {l}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function CountriesPage() {
  const countries = useCountries();
  const [search, setSearch] = useState("");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        eyebrow="Countries"
        title="Across the continent"
        description="Each country brings its own health priorities and cases. More open as their content is approved."
      />
      <Input
        placeholder="Search countries"
        aria-label="Search countries"
        className="mb-6 max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryState query={countries}>
        {({ items }) => {
          const filtered = items.filter((c) =>
            c.name.toLowerCase().includes(search.trim().toLowerCase()),
          );
          if (!filtered.length)
            return <EmptyState title="No countries match" description="Try a different search." />;
          return (
            <div className="space-y-8">
              {Object.keys(REGION_LABELS).map((region) => {
                const list = filtered.filter((c) => c.region === region);
                if (!list.length) return null;
                return (
                  <section key={region}>
                    <h2 className="mb-3 text-xl font-extrabold">{REGION_LABELS[region]}</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {list.map((c) => (
                        <CountryCard key={c.code} country={c} to={`/countries/${c.code}`} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}

export function CountryPage() {
  const { code = "" } = useParams();
  const country = useQuery({ queryKey: ["country", code], queryFn: () => countriesApi.get(code) });
  const missions = useQuery({
    queryKey: ["missions", "practice", code],
    queryFn: () => missionsApi.list({ mode: "practice", country: code }),
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <QueryState query={country}>
        {(c) => (
          <>
            <PageHeader
              back={{ to: "/countries", label: "All countries" }}
              eyebrow={REGION_LABELS[c.region]}
              title={
                <span className="flex items-center gap-3">
                  <CountryFlag country={c} /> {c.name}
                </span>
              }
              description={c.focus}
            />
            {mediaUrl(c.imageUrl) && (
              <img
                src={mediaUrl(c.imageUrl)!}
                alt=""
                className="mb-6 aspect-[16/7] w-full rounded-2xl border-2 border-foreground object-cover"
              />
            )}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-4 md:col-span-2">
                {c.description ? (
                  <p className="whitespace-pre-line text-lg leading-relaxed">{c.description}</p>
                ) : null}
                {c.healthPriorities.length > 0 && (
                  <Card flat>
                    <CardHeader>
                      <CardTitle>Health priorities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc space-y-1 pl-5">
                        {c.healthPriorities.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
              <Card flat className="h-fit">
                <CardContent className="space-y-2 pt-5 text-sm">
                  <div>
                    <span className="font-bold">Status: </span>
                    {c.status === "active" ? "Open to play" : "Coming soon"}
                  </div>
                  <div>
                    <span className="font-bold">Unlocks at: </span>
                    {c.unlock.minHp} HP
                  </div>
                  {c.languages.length > 0 && (
                    <div>
                      <span className="font-bold">Languages: </span>
                      {c.languages.join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <h2 className="mb-3 mt-10 text-xl font-extrabold">Cases in {c.name}</h2>
            <QueryState
              query={missions}
              isEmpty={(d) => d.items.length === 0}
              empty={
                <EmptyState
                  icon="🩺"
                  title="No approved cases yet"
                  description="Cases for this country are being written and reviewed."
                />
              }
            >
              {(d) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  {d.items.map((m) => (
                    <Link
                      key={m.key}
                      to={`/play/missions/${m.key}`}
                      className="rounded-2xl border-2 border-foreground bg-card p-4 shadow-pop-sm hover:-translate-y-0.5"
                    >
                      <MissionTitle m={m} />
                      <div className="mt-2">
                        <TopicChips topics={m.topics} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </QueryState>
          </>
        )}
      </QueryState>
    </div>
  );
}
