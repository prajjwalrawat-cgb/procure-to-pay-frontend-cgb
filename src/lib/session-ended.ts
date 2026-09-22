/**
 * Marks a bounce to a login page as "the client proved this session is dead",
 * as opposed to an ordinary visit.
 *
 * The middleware gates each portal on the mere presence of the httpOnly refresh
 * cookie, and the refresh route deliberately never deletes that cookie on a 401
 * (the failure can be a lost rotation race against another tab, and deleting on
 * that basis signs out the tab that won). A cookie holding a genuinely dead
 * refresh token therefore used to pin the app in a redirect loop: the client
 * bounced to /login, the middleware saw the cookie and bounced it back into the
 * portal, the portal failed to refresh and bounced to /login again — forever,
 * with the URL stuck on `/?next=%2F`. Only an explicit logout, which does clear
 * the cookie, escaped it.
 *
 * This parameter is the client telling the middleware what the cookie cannot:
 * do not send me back, I have just been refused. Both `endSession` (which sets
 * it) and `middleware` (which honours it) live on either side of that contract,
 * so it sits in its own module — the middleware runs on the edge and must not
 * pull in a `'use client'` module to read it.
 */
export const SESSION_ENDED_PARAM = 'expired';
