import { NextRequest, NextResponse } from "next/server";
import { PamError, readPam } from "@/lib/pam";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origin ไม่ถูกต้อง" }, { status: 403 });
  try {
    const { resource } = await context.params;
    return NextResponse.json(await readPam(resource), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const err = error instanceof PamError ? error : new PamError("เกิดข้อผิดพลาดในการอ่านข้อมูล");
    return NextResponse.json({ error: err.message, upstreamStatus: err.upstreamStatus }, { status: err.status, headers: { "Cache-Control": "no-store" } });
  }
}
