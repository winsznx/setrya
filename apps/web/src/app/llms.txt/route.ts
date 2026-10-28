import { getAllDocs } from '@/lib/docs/content';
import { buildLlmsTxt } from '@/lib/docs/llms';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(buildLlmsTxt(getAllDocs()), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
