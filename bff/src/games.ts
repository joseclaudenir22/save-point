import { igdbQuery } from "./igdb";

// ===================== Contrato: o que o app recebe =====================

export interface GameSummary {
  id: number;
  name: string;
  coverUrl: string | null;
  releaseYear: number | null;
  rating: number | null; // 0–100, inteiro
}

export interface GameDetail extends GameSummary {
  summary: string | null;
  developer: string | null;
  platforms: string[];
  genres: string[];
  screenshotUrls: string[];
}

export interface GamesPage {
  items: GameSummary[];
  page: number;
  pageSize: number;
  hasNext: boolean;
}

// ===================== Validação dos parâmetros =====================

export class ValidationError extends Error {
  name = "ValidationError";
}

const PLATFORMS: Record<string, number> = {
  switch: 130,
  ps5: 167,
  "xbox-series": 169,
  pc: 6,
};

type Sort = "popular" | "top_rated" | "newest";
const SORTS: Sort[] = ["popular", "top_rated", "newest"];

export interface ListParams {
  query: string | null;
  platform: string | null;
  sort: Sort;
  page: number;
  pageSize: number;
}

export function parseListParams(params: URLSearchParams): ListParams {
  // Remove caracteres que poderiam "escapar" da string na query Apicalypse
  const cleaned = (params.get("q") ?? "").replace(/["\\;]/g, "").trim().slice(0, 100);
  const query = cleaned.length > 0 ? cleaned : null;

  const platform = params.get("platform");
  if (platform !== null && !Object.hasOwn(PLATFORMS, platform)) {
    throw new ValidationError(`Unknown platform: ${platform}`);
  }

  const sort = params.get("sort") ?? "popular";
  if (!SORTS.includes(sort as Sort)) {
    throw new ValidationError(`Unknown sort: ${sort}`);
  }

  const page = parsePositiveInt(params.get("page"), 1);
  const pageSize = parsePositiveInt(params.get("pageSize"), 20);
  if (pageSize > 50) throw new ValidationError("pageSize must be at most 50");

  return { query, platform, sort: sort as Sort, page, pageSize };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new ValidationError(`Invalid number: ${value}`);
  return n;
}

// ===================== Tradução para Apicalypse =====================

const LIST_FIELDS = "fields name, cover.image_id, first_release_date, total_rating;";

const DETAIL_FIELDS =
  "fields name, summary, cover.image_id, first_release_date, total_rating, " +
  "platforms.name, genres.name, screenshots.image_id, " +
  "involved_companies.developer, involved_companies.company.name;";

export function buildListQuery(p: ListParams, nowSeconds: number): string {
  const where = [
    "game_type = (0,8,9)", // jogo principal, remake, remaster (sem DLC, bundle, mod…)
    "version_parent = null", // sem "Deluxe Edition", "GOTY Edition"…
    "cover != null",
  ];
  if (p.platform) where.push(`platforms = (${PLATFORMS[p.platform]})`);

  const parts = [LIST_FIELDS];

  if (p.query) {
    parts.push(`search "${p.query}";`); // ordena por relevância; não aceita sort
  } else if (p.sort === "popular") {
    where.push("total_rating_count > 0");
    parts.push("sort total_rating_count desc;");
  } else if (p.sort === "top_rated") {
    where.push("total_rating_count >= 20"); // evita jogo obscuro com uma nota 100
    parts.push("sort total_rating desc;");
  } else {
    where.push(`first_release_date <= ${nowSeconds}`); // só os já lançados
    parts.push("sort first_release_date desc;");
  }

  parts.push(`where ${where.join(" & ")};`);
  parts.push(`limit ${p.pageSize + 1};`); // +1 para descobrir se existe próxima página
  parts.push(`offset ${(p.page - 1) * p.pageSize};`);
  return parts.join(" ");
}

// ===================== Mapeamento IGDB → contrato =====================

interface IgdbGame {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number; // unix em segundos
  total_rating?: number;
  summary?: string;
  platforms?: { name: string }[];
  genres?: { name: string }[];
  screenshots?: { image_id: string }[];
  involved_companies?: { developer: boolean; company: { name: string } }[];
}

const imageUrl = (size: string, imageId: string) =>
  `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;

function toSummary(g: IgdbGame): GameSummary {
  return {
    id: g.id,
    name: g.name,
    coverUrl: g.cover ? imageUrl("t_cover_big", g.cover.image_id) : null,
    releaseYear: g.first_release_date
      ? new Date(g.first_release_date * 1000).getUTCFullYear()
      : null,
    rating: g.total_rating != null ? Math.round(g.total_rating) : null,
  };
}

function toDetail(g: IgdbGame): GameDetail {
  return {
    ...toSummary(g),
    summary: g.summary ?? null,
    developer: g.involved_companies?.find((c) => c.developer)?.company.name ?? null,
    platforms: g.platforms?.map((p) => p.name) ?? [],
    genres: g.genres?.map((x) => x.name) ?? [],
    screenshotUrls: g.screenshots?.map((s) => imageUrl("t_720p", s.image_id)) ?? [],
  };
}

// ===================== Casos de uso =====================

export async function listGames(env: Env, params: URLSearchParams): Promise<GamesPage> {
  const p = parseListParams(params);
  const query = buildListQuery(p, Math.floor(Date.now() / 1000));
  const games = await igdbQuery<IgdbGame[]>(env, "games", query);

  return {
    items: games.slice(0, p.pageSize).map(toSummary),
    page: p.page,
    pageSize: p.pageSize,
    hasNext: games.length > p.pageSize,
  };
}

export async function getGame(env: Env, id: number): Promise<GameDetail | null> {
  const games = await igdbQuery<IgdbGame[]>(env, "games", `${DETAIL_FIELDS} where id = ${id};`);
  return games[0] ? toDetail(games[0]) : null;
}