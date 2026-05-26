# SpringBot Backend

API service for Spring Office.

## Working endpoints

- `GET /health` checks service, AI, and Discord configuration.
- `GET /api/presence` returns currently active office users.
- `POST /api/presence` records room and availability heartbeats.
- `POST /api/notes` generates structured meeting notes, using AI when configured.
- `POST /api/chat` powers SpringBot with recent conversation history and workspace context when AI is configured.
- `GET /api/discord/status` verifies the Discord bot server-side and returns its safe install link.
- `POST /api/discord/message` posts an office announcement through SpringBot after an admin-key check.

## Deploy on Render

Create a Render web service from this repository. The included `render.yaml` runs the Node server with no package dependencies.

Set these environment variables:

- `ALLOWED_ORIGIN`: `https://que2003.github.io`, or `*` while testing.
- `OPENAI_API_KEY`: required for intelligent SpringBot answers and AI-generated notes.
- `OPENAI_MODEL`: the model to use for assistant requests.
- `DISCORD_TOKEN`: your existing SpringBot Discord token; it remains only on the backend.
- `DISCORD_APPLICATION_ID`: Discord application ID used for the Add to Discord button.
- `DISCORD_CHANNEL_ID`: channel where authorized office updates should be posted.
- `OFFICE_ADMIN_KEY`: private passphrase required when posting from the office to Discord.

When Render supplies the public backend URL, enter it in the website's **Setup** view. Room presence then syncs between visitors. When AI settings are set, SpringBot switches to `AI ready` mode. When Discord settings are set, the office Discord Hub can verify SpringBot, open its server installation flow, and send protected announcements through the bot.

Never put the Discord token or the admin posting key in frontend files or GitHub Pages settings.
