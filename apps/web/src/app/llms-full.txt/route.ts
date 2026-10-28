import { getAllDocs } from '@/lib/docs/content';
import { buildLlmsFullTxt } from '@/lib/docs/llms';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(buildLlmsFullTxt(getAllDocs()), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
