

## Problem

Supabase invite links (PKCE flow) redirect to `/set-password?code=XXXXX`. The current `SetPassword` page only listens for `onAuthStateChange` events and checks existing sessions, but never calls `supabase.auth.exchangeCodeForSession(code)` to process the PKCE code from the URL. As a result, the session is never established and the page stays on "Weryfikacja linku..." forever.

## Solution

Update `SetPassword.tsx` to detect `code` query parameter from the URL and exchange it for a session using `supabase.auth.exchangeCodeForSession()`.

## Technical Details

### File: `src/pages/SetPassword.tsx`

In the `useEffect`, add logic to:

1. Read the `code` query parameter from `window.location.search` (using `URLSearchParams`)
2. If `code` exists, call `supabase.auth.exchangeCodeForSession(code)` 
3. On success, set `ready = true`
4. On error, show a toast with an error message and optionally redirect to `/auth`
5. Also handle the hash fragment flow (for older Supabase configs) as a fallback — keep the existing `onAuthStateChange` listener

The updated useEffect will look conceptually like:

```text
useEffect:
  1. Set up onAuthStateChange listener (existing, keep as fallback)
  2. Check for ?code= in URL params
     - If found: call exchangeCodeForSession(code)
       - Success -> setReady(true)
       - Error -> show toast, redirect to /auth
  3. Check existing session (existing, keep as fallback)
```

Additionally, add a timeout (e.g. 10 seconds) so that if neither the code exchange nor the auth event fires, the user sees an error message instead of waiting forever on "Weryfikacja linku...".

No database changes or edge function changes needed.
