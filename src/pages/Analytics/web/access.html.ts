import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
  const destination = new URL('https://g-analytics.johnwakaba146.workers.dev/access.html');
  destination.search = url.search;
  return Response.redirect(destination, 302);
};
