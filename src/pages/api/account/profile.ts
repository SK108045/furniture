import type { APIRoute } from 'astro';
import { requireUser } from '../../../server/auth';
import { body, failure, json } from '../../../server/http';
import { database, query } from '../../../server/database';
import { customerDetails } from '../../../server/validation';
export const GET: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const [row] = await database<{details:unknown}[]>(`nicoo_profiles?${query({user_id:`eq.${userId}`,select:'details'})}`);
    return json({profile: row ? row.details : null});
  } catch (error) { return failure(error); }
};
export const PUT: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const profile = {...customerDetails(await body(request)), updatedAt: new Date().toISOString()};
    await database('nicoo_profiles?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:userId,details:profile})});
    return json({profile});
  } catch (error) { return failure(error); }
};
export const DELETE: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    await database(`nicoo_profiles?${query({user_id:`eq.${userId}`})}`,{method:'DELETE'});
    return json({profile:null});
  } catch(error) { return failure(error); }
};
