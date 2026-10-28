import { getAllDocs } from '@/lib/docs/content';
import { MAX_QUERY_LENGTH, searchDocs } from '@/lib/docs/search';

const MAX_LIMIT = 20;

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);
  const requested = Number(params.get('limit') ?? 8);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : 8;
  return Response.json({ query, results: searchDocs(getAllDocs(), query, limit) }, { headers: { 'cache-control': 'public, max-age=300' } });
}
