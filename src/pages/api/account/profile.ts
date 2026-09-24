import type { APIRoute } from 'astro';
import { requireUser } from '../../../server/auth';
import { body, failure, json } from '../../../server/http';
import { db } from '../../../server/database';
import { customerDetails } from '../../../server/validation';
export const GET: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const row = db().prepare('SELECT details FROM profiles WHERE user_id=?').get(userId) as {details: string} | undefined;
    return json({profile: row ? JSON.parse(row.details) : null});
  } catch (error) { return failure(error); }
};
export const PUT: APIRoute = async ({request}) => {
  try {
    const userId = await requireUser(request);
    const profile = customerDetails(await body(request));
    db().prepare('INSERT INTO profiles (user_id,details) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET details=excluded.details').run(userId,JSON.stringify(profile));
    return json({profile});
  } catch (error) { return failure(error); }
};
