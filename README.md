# SpringBot Backend

API service for Spring Office.

## Working endpoints

- `GET /health` checks service and AI configuration.
- `GET /api/presence` returns currently active office users.
- `POST /api/presence` records room and availability heartbeats.
- `POST /api/notes` generates structured meeting notes, using AI when configured.
- `POST /api/chat` powers SpringBot with recent conversation history and current workspace context when AI is configured.

## Deploy on Render

Create a Render web service from this repository. The included `render.yaml` runs the Node server with no package dependencies.

Set these environment variables:

- `ALLOWED_ORIGIN`: `https://que2003.github.io`, or `*` while testing.
- `OPENAI_API_KEY`: required for intelligent SpringBot answers and AI-generated notes.
- `OPENAI_MODEL`: the model to use for assistant requests.

When Render supplies the public backend URL, enter it in the website's **Setup** view. Room presence then syncs between live visitors. When the backend also has AI settings, SpringBot switches to `AI ready` mode and can draft, brainstorm, plan, summarize, and respond conversationally using recent chat context.

Without a backend URL, Spring Office operates locally and offers planning templates without pretending to be a full AI assistant.
