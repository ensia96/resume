import type { APIRoute } from 'astro';
import { loadResume } from '../lib/content';

export const GET: APIRoute = async () => {
  const { sections, source } = await loadResume();
  return new Response(JSON.stringify({
    ...source,
    documents: sections.map(({ filename, title, order }) => ({ filename, title, order })),
  }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
