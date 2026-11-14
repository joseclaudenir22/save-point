import { getAccessToken } from "./twitch";

const IGDB_BASE_URL = "https://api.igdb.com/v4";

export async function igdbQuery<T>(env: Env, endpoint: string, query: string): Promise<T> {
  let token = await getAccessToken(env);
  let response = await callIgdb(env, endpoint, query, token);

  if (response.status === 401) {
    // token revogado ou expirado antes da hora: renova e tenta UMA vez
    token = await getAccessToken(env, true);
    response = await callIgdb(env, endpoint, query, token);
  }

  if (!response.ok) {
    throw new Error(`IGDB request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function callIgdb(env: Env, endpoint: string, query: string, token: string): Promise<Response> {
  return fetch(`${IGDB_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: query,
  });
}