import type { APIRoute } from 'astro';
import { requireUser } from '../../../server/auth';
import { failure, json } from '../../../server/http';
import { getOrder, publicOrder } from '../../../server/orders';
export const GET: APIRoute = async ({request,params}) => {
  try { return json({order: publicOrder(getOrder(params.id!, await requireUser(request)))}); }
  catch (error) { return failure(error); }
};
