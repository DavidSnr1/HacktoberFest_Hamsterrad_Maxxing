import { NextResponse } from "next/server";

/** Error body shared by all API routes; `error` is a German message for the UI. */
export type ApiError = { error: string };

export function apiError(status: number, error: string) {
  return NextResponse.json<ApiError>({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiOk<T>(body: T, status = 200) {
  return NextResponse.json<T>(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Parses a JSON body; also accepts text/plain bodies sent via navigator.sendBeacon. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text());
  } catch {
    return undefined;
  }
}
