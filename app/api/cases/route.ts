import { NextResponse } from "next/server";
import { createCase, listCases, type CasePriority } from "@/lib/cases";

export async function GET() {
  return NextResponse.json({ cases: listCases() });
}

export async function POST(request: Request) {
  let body: { title?: string; priority?: CasePriority };
  try {
    body = (await request.json()) as { title?: string; priority?: CasePriority };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const caseItem = createCase({
      title: body.title ?? "",
      priority: body.priority,
    });
    return NextResponse.json({ case: caseItem }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
