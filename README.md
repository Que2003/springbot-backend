# SpringBot Backend

API service for Spring Virtual Office.

## Working endpoints

- `GET /health` checks service and AI configuration.
- `GET /api/presence` returns currently active office users.
- `POST /api/presence` records room and availability heartbeats.
- `POST /api/notes` generates structured meeting notes, using AI when configured.
- `POST /api/chat` powers SpringBot responses when AI is configured.

## Deploy on Render

Create a Render web service from this repository. The included `render.yaml` runs the Node server with no package dependencies.

Set these environment variables:

- `ALLOWED_ORIGIN`: the published Spring Virtual Office website origin, or `*` while testing.
- `OPENAI_API_KEY`: required only for AI meeting notes and SpringBot assistant responses.
- `OPENAI_MODEL`: the model name you choose for assistant requests.

When Render supplies the public backend URL, enter it in the website's **Settings** view. Room presence then syncs between live visitors. Without the API URL, the frontend stays honest: it operates locally and marks sample teammates as preview data.
