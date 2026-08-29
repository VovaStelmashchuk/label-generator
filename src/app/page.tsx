import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

export default function LandingPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background px-5 py-20 text-center">
      <div className="max-w-3xl space-y-8">
        <div className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-primary/10 px-4 py-1.5 text-sm font-medium text-accent-primary mb-4">
          <Icon name="lucide:sparkles" className="size-4" />
          <span>Your all-in-one PDF toolkit</span>
        </div>
        
        <h1 className="text-5xl font-extrabold tracking-tight text-label-primary sm:text-6xl">
          Generate printable PDFs <br className="hidden sm:block" /> in seconds.
        </h1>
        
        <p className="mx-auto max-w-2xl text-lg text-label-secondary sm:text-xl">
          Whether you need perfectly sized labels for your jars, a quick ruler, or grid paper, 
          LabelGen creates precise, home-printable PDFs instantly. No design skills required.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pt-4">
          <Button href="/generator" variant="primary" size="md" icon="lucide:tag">
            Go to Label Generator
          </Button>
          <Button href="https://github.com/VovaStelmashchuk/label-generator" target="_blank" variant="ghost" size="md" icon="lucide:github">
            Star on GitHub
          </Button>
        </div>
      </div>

      <div className="mt-24 grid w-full max-w-5xl gap-8 sm:grid-cols-2 md:grid-cols-3 text-left">
        <FeatureCard 
          icon="lucide:tag" 
          title="Label Generator" 
          description="Create beautiful, perfectly-sized labels for jars, boxes, and shelves. Ready to print on A4."
          active
          href="/generator"
        />
        <FeatureCard 
          icon="lucide:ruler" 
          title="Printable Rulers" 
          description="Need a ruler right now? Generate an accurate, to-scale PDF ruler to print instantly."
          active={false}
        />
        <FeatureCard 
          icon="lucide:grid-3x3" 
          title="Graph & Grid Paper" 
          description="Customizable grid, dot, and isometric paper for math, engineering, or bullet journaling."
          active={false}
        />
        <FeatureCard 
          icon="lucide:calendar-days" 
          title="Planners & Calendars" 
          description="Daily, weekly, and monthly planner templates to keep your life organized."
          active={false}
        />
        <FeatureCard 
          icon="lucide:list-todo" 
          title="Checklists" 
          description="Minimalist to-do lists and habit trackers tailored to your exact needs."
          active={false}
        />
        <FeatureCard 
          icon="lucide:music" 
          title="Sheet Music" 
          description="Blank staff paper and tablature for musicians and composers."
          active={false}
        />
      </div>
    </main>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  active,
  href
}: { 
  icon: string; 
  title: string; 
  description: string;
  active: boolean;
  href?: string;
}) {
  const content = (
    <div className={`relative flex h-full flex-col gap-3 rounded-2xl border p-6 transition-colors ${active ? 'border-accent-primary bg-accent-primary/5 hover:border-accent-primary/80' : 'border-separator-secondary bg-surface opacity-75'}`}>
      <div className={`inline-flex size-10 items-center justify-center rounded-lg ${active ? 'bg-accent-primary text-white' : 'bg-fill-secondary text-label-secondary'}`}>
        <Icon name={icon} className="size-5" />
      </div>
      <h3 className="text-xl font-bold text-label-primary">
        {title}
        {!active && <span className="ml-2 inline-block rounded-md bg-fill-tertiary px-2 py-0.5 text-xs font-medium text-label-secondary">Coming Soon</span>}
      </h3>
      <p className="text-sm text-label-secondary">{description}</p>
    </div>
  );

  if (active && href) {
    return <Link href={href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-2xl">{content}</Link>;
  }

  return content;
}
