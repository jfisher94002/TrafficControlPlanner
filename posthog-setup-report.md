<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the TrafficControlPlan FastAPI backend. A `Posthog` client instance is initialized at module load time using environment variables (`POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`) with exception autocapture enabled. `posthog_client.shutdown` is registered with `atexit` to flush events on exit. Six business events are captured across the two core API endpoints, covering the full export workflow, feedback submission lifecycle, and bot/spam detection signals. `posthog_client.flush()` is called after every capture to ensure events are not lost in the AWS Lambda execution environment.

| Event | Description | File |
|---|---|---|
| `pdf_exported` | User successfully exported a traffic control plan as a PDF | `backend/main.py` |
| `pdf_export_failed` | PDF generation failed due to an internal error | `backend/main.py` |
| `feedback_submitted` | User successfully submitted a feedback issue to GitHub | `backend/main.py` |
| `feedback_blocked_honeypot` | A submission was blocked because the honeypot field was filled (bot detection) | `backend/main.py` |
| `feedback_blocked_speed` | A submission was blocked because it was submitted too quickly (bot detection) | `backend/main.py` |
| `feedback_rate_limited` | A submission was blocked due to rate limiting | `backend/main.py` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/356990/dashboard/1500636
- **PDF Exports over time** (line chart, daily): https://us.posthog.com/project/356990/insights/NW2Kl6SN
- **PDF Export success vs failure** (bar chart): https://us.posthog.com/project/356990/insights/FE8YMhpi
- **Feedback submission funnel**: https://us.posthog.com/project/356990/insights/uR8yS0vz
- **Feedback submissions by type** (bar chart, breakdown): https://us.posthog.com/project/356990/insights/Ys8NVean
- **Bot/spam detections** (stacked bar): https://us.posthog.com/project/356990/insights/3RLBxWVp

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
