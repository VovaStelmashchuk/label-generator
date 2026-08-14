import { LabelForm } from '@/components/label-form';
import { Icon } from '@/components/ui/icon';
import { Tag } from '@/components/ui/tag';

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <header className="mb-10 border-b-2 border-accent-primary pb-6">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="lucide:tag" className="size-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Label Generator
          </h1>
        </div>
        <p className="max-w-2xl text-label-secondary">
          Type the text, pick a size in centimetres, and download one A4 page
          filled with labels for jars, zip bags and shelves.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag icon="lucide:file-text">A4, one page</Tag>
          <Tag icon="lucide:printer">Home printer</Tag>
        </div>
      </header>

      <LabelForm />
    </main>
  );
}
