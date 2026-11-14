const TOKEN_KEY = "igdb:access_token";
const REFRESH_MARGIN_SECONDS = 300; // renova 5 min antes de expirar

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch em ms
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number; // segundos
  token_type: string;
}

export async function getAccessToken(env: Env, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await env.TOKEN_CACHE.get<CachedToken>(TOKEN_KEY, "json");
    if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_SECONDS * 1000) {
      return cached.accessToken;
    }
  }
  return requestNewToken(env);
}

async function requestNewToken(env: Env): Promise<string> {
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(`Twitch token request failed: ${response.status}`);
  }

  const body = (await response.json()) as TwitchTokenResponse;
  const token: CachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };

  await env.TOKEN_CACHE.put(TOKEN_KEY, JSON.stringify(token), {
    expirationTtl: Math.max(60, body.expires_in - REFRESH_MARGIN_SECONDS),
  });

  return token.accessToken;
}