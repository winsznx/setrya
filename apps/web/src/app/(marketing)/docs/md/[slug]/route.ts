import { docAsMarkdown, getDoc } from '@/lib/docs/content';
import { DOC_PAGES } from '@/lib/docs/manifest';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return DOC_PAGES.map((page) => ({ slug: page.slug }));
}

/** Served at /docs/<slug>.md through the rewrite in next.config.ts. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(docAsMarkdown(doc), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'x-robots-tag': 'noindex' } });
}
