import { currentUser, sameOrigin } from './auth';
// Wrap every shopkeeper API: must be logged in, same-origin for writes, errors never leak details.
export const admin = (handler) => async (req, ctx) => {
  const user = currentUser();
  if (!user) return Response.json({ error: 'Please sign in' }, { status: 401 });
  if (req.method !== 'GET' && !sameOrigin(req)) return Response.json({ error: 'Blocked: bad origin' }, { status: 403 });
  try { return await handler(req, user, ctx); }
  catch (e) { console.error(e); return Response.json({ error: 'Server error' }, { status: 500 }); }
};
