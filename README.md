# nostalgija-bot

<p align="center">
  <img src="assets/nostalgija-mascot.png" alt="Nostalgija bot mascot: a time-traveling messenger pigeon holding an old photo" width="320">
</p>

A daily Telegram MOTD job that always selects a message from the same calendar
day one year ago. It can also post one exceptional bonus memory from two or
more years ago. It reads chat history directly through Telegram's client API
and posts the result through the existing Telegram bot.

The older bonus is additive: it is only considered when there is a viable
one-year MOTD, and is never posted by itself as a replacement.

The client API session is a user session because Telegram does not allow bot
accounts to call `messages.getHistory`.

## Setup

1. Create an application at <https://my.telegram.org/apps> to get an API ID and
   API hash.
2. Install dependencies with `pnpm install`.
3. Run `pnpm run configure` to enter the API ID, API hash, and target chat ID
   locally, or copy `.env.example` to `.env` and fill them manually.
4. Authorize the user session once with `pnpm run login`. Telegram will ask for the
   phone number, login code, and 2FA password when applicable.
5. Verify without posting by setting `TELEGRAM_DRY_RUN=true` and running
   `pnpm start`.

The bot token is not required for a dry run. Add it only when you are ready to
test an actual post.

`TELEGRAM_SESSION_PATH` must point to persistent, private storage. The session
grants access to the authenticated Telegram account and must never be committed,
logged, or placed in a disposable container filesystem.

The example uses `./data/nostalgija-user.session` for local development and
creates the parent directory automatically.

The bonus anniversary rules are:

- search every anniversary from 2 years ago back to the chat's oldest available
  message;
- qualify a candidate with at least 4 reactions or 3 same-day replies;
- post only the strongest qualifying candidate, as a separate reply to its
  original message.

Bot-authored messages are excluded from candidates and reply scoring so earlier
MOTD posts cannot recursively become future memories.

Change the thresholds with `NOSTALGIA_BONUS_MIN_REACTIONS` and
`NOSTALGIA_BONUS_MIN_REPLIES`.

By default, a chat day runs from 02:00 through 01:59 the following morning in
`TELEGRAM_CHAT_LOCATION`, keeping after-midnight discussions with the evening
that started them. Change the boundary with `NOSTALGIA_DAY_START_HOUR`.

Telegram's current reaction totals are treated as useful signal even if someone
reacted after rediscovering a message through an earlier MOTD. Reply counts only
include replies from the original calendar day, so later bot posts do not add to
that score.

The configured user must be a member of `TELEGRAM_CHAT_ID`. The bot identified
by `TELEGRAM_API_KEY` must be able to post in the same chat.

## Docker and cron

The deployment image is built locally; GitHub Actions only runs lint, tests,
and the TypeScript build and does not publish container images.

Build the image locally:

```sh
docker build -t nostalgija-bot .
```

Authorize once, mounting the same data directory that cron will use:

```sh
docker run --rm -it \
  --env-file .env \
  --env TELEGRAM_SESSION_PATH=/data/nostalgija-user.session \
  -v /private/path/nostalgija:/data \
  nostalgija-bot node dist/login.js
```

Then run the normal daily job with the same environment and volume:

```cron
0 9 * * * docker run --rm --env-file /private/path/nostalgija.env --env TELEGRAM_SESSION_PATH=/data/nostalgija-user.session -v /private/path/nostalgija:/data nostalgija-bot
```

No Telegram Desktop export or yearly re-export is required.

## Development

```sh
pnpm audit:ci
pnpm lint
pnpm test
pnpm build
```

The current migration deliberately preserves the existing selection rules:

- ignore text shorter than five characters unless the message is a photo;
- prefer messages with multiple replies or reactions;
- weight reply count by 1.5 when comparing replies with reactions;
- otherwise select a random viable message.
