import type { Metadata } from 'next';
import PageTitle from '../../_ui/PageTitle';
import Link from 'next/link';
import { getEntries, getLogs, getCodes, allTags, toFeed } from '@/server/content';
import EntryCard from '../../_ui/EntryCard';
import LogCard from '../../_ui/LogCard';
import PageWash from '../../_chrome/PageWash';

export async function generateStaticParams() {
  return (await allTags()).map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${tag}`,
    description: `Entries and logs tagged “${tag}”.`,
    alternates: { canonical: `/tags/${tag}/` },
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const [allEntries, allLogs, codes] = await Promise.all([getEntries(), getLogs(), getCodes()]);
  const entries = allEntries.filter((e) => e.data.tags.includes(tag));
  const logs = allLogs.filter((l) => l.data.tags.includes(tag));
  const items = toFeed(entries, logs);

  return (
    <>
      <PageWash hue={26} />
      <div className="wrap py-10">
        <header>
          <p className="kicker">tag</p>
          <PageTitle>#{tag}</PageTitle>
          <p className="rail mt-3">
            {items.length} {items.length === 1 ? 'item' : 'items'} ·{' '}
            <Link href="/tags/">all tags</Link>
          </p>
        </header>
        <h2 className="sr-only">Tagged items</h2>
        <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3">
          {items.map((item) =>
            item.type === 'entry' ? (
              <EntryCard
                key={`e-${item.entry.id}`}
                entry={item.entry}
                code={codes.get(`entries:${item.entry.id}`) ?? 'E-000'}
                compact
                showCategory
              />
            ) : (
              <LogCard
                key={`l-${item.log.id}`}
                log={item.log}
                code={codes.get(`logs:${item.log.id}`) ?? 'L-000'}
                showCategory
              />
            ),
          )}
        </div>
      </div>
    </>
  );
}
