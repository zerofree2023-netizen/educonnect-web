import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/admin/schools/filters
export async function GET() {
  return NextResponse.json({
    ok: true,
    filters: {},
  });
}
