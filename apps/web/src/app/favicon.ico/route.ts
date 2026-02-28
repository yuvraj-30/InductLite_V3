import { NextResponse } from "next/server";

export function GET(request: Request) {
  const iconUrl = new URL("/favicon.svg", request.url);
  return NextResponse.redirect(iconUrl, { status: 307 });
}
