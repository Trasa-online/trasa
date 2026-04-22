<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into **Trasa.travel**, a React Router v6 + Vite travel planning application.

## What was done

- Installed `posthog-js` and `@posthog/react` packages
- Initialized PostHog in `src/main.tsx` alongside existing Sentry and Vercel analytics, wrapped the app in `PostHogProvider` and `PostHogErrorBoundary`
- Set `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` in `.env`
- Added `posthog.identify()` on successful login to correlate events with users
- Added `posthog.captureException()` in auth and group session error handlers
- Instrumented 14 events across 5 key files covering the full user funnel from landing page trial through group trip planning

## Events

| Event | Description | File |
|-------|-------------|------|
| `trial_modal_opened` | User opened the trial/demo modal on the landing page | `src/components/trial/TrialModal.tsx` |
| `trial_city_selected` | User selected a city in the trial modal | `src/components/trial/TrialModal.tsx` |
| `trial_place_liked` | User liked a place in the trial modal swipe flow | `src/components/trial/TrialModal.tsx` |
| `trial_results_viewed` | User reached the results step in the trial modal | `src/components/trial/TrialModal.tsx` |
| `trial_signup_cta_clicked` | User clicked the sign-up CTA from the trial results screen | `src/components/trial/TrialModal.tsx` |
| `user_signed_in` | User successfully logged in with email/password | `src/pages/Auth.tsx` |
| `user_waitlisted` | User submitted their email to the waitlist during registration | `src/pages/Auth.tsx` |
| `business_claim_submitted` | A business owner submitted a claim to register their venue | `src/pages/Auth.tsx` |
| `plan_city_selected` | User selected a city in the solo PlanWizard flow | `src/pages/PlanWizard.tsx` |
| `plan_category_selected` | User selected a category in the solo PlanWizard flow | `src/pages/PlanWizard.tsx` |
| `group_session_created` | User created a new group planning session | `src/pages/CreateGroupSession.tsx` |
| `group_session_joined` | User joined an existing group session via code | `src/pages/CreateGroupSession.tsx` |
| `group_invites_sent` | User sent in-app invites to friends when starting a group session | `src/pages/CreateGroupSession.tsx` |
| `day_review_completed` | User completed the AI-guided day review conversation | `src/pages/DayReview.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/164244/dashboard/636902
- **Trial conversion funnel** (trial modal → results → signup CTA): https://eu.posthog.com/project/164244/insights/z34UE5v5
- **New sign-ins & waitlist signups** (daily trend): https://eu.posthog.com/project/164244/insights/f4or0Uq2
- **Group session activity** (created / joined / invites): https://eu.posthog.com/project/164244/insights/Kd8AzSsM
- **Plan wizard city popularity** (top cities, last 30 days): https://eu.posthog.com/project/164244/insights/nQVSFqar
- **Day review completions** (weekly retention signal): https://eu.posthog.com/project/164244/insights/eUYlyUnW

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
