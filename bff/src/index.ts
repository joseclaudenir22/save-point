export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    return Response.json(
      { code: "not_found", message: "Route not found" },
      { status: 404 },
    );
  },
} satisfies ExportedHandler<Env>;