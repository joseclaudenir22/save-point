import { getGame, listGames, ValidationError } from "./games";

const GAME_DETAIL_PATH = /^\/v1\/games\/(\d+)$/;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return errorResponse(405, "method_not_allowed", "Only GET is supported");
    }

    try {
      if (url.pathname === "/health") {
        return Response.json({ status: "ok" });
      }

      if (url.pathname === "/v1/games") {
        return jsonResponse(await listGames(env, url.searchParams), 300);
      }

      const detailMatch = url.pathname.match(GAME_DETAIL_PATH);
      if (detailMatch) {
        const game = await getGame(env, Number(detailMatch[1]));
        return game
          ? jsonResponse(game, 3600)
          : errorResponse(404, "not_found", "Game not found");
      }

      return errorResponse(404, "not_found", "Route not found");
    } catch (error) {
      if (error instanceof ValidationError) {
        return errorResponse(400, "invalid_parameter", error.message);
      }
      console.error(error);
      return errorResponse(502, "upstream_error", "Game database unavailable");
    }
  },
} satisfies ExportedHandler<Env>;

function jsonResponse(body: unknown, maxAgeSeconds: number): Response {
  return Response.json(body, {
    headers: { "Cache-Control": `public, max-age=${maxAgeSeconds}` },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}