import { igdbQuery } from "./igdb";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({ status: "ok" });
      }

      // TEMPORÁRIA: removida na etapa 4, quando entra o /v1/games
      if (request.method === "GET" && url.pathname === "/debug/igdb") {
        const games = await igdbQuery<{ id: number; name: string }[]>(
          env,
          "games",
          "fields name; where platforms = (130) & total_rating_count > 50; sort total_rating desc; limit 5;",
        );
        return Response.json(games);
      }

      return Response.json({ code: "not_found", message: "Route not found" }, { status: 404 });
    } catch (error) {
      console.error(error);
      return Response.json(
        { code: "upstream_error", message: "Game database unavailable" },
        { status: 502 },
      );
    }
  },
} satisfies ExportedHandler<Env>;