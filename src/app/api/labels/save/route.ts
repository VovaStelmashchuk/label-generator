import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromServer } from "@/lib/auth";
import { getDb } from "@/lib/mongo";
import { parseSpec } from "@/lib/label-spec";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromServer();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
    }

    const spec = parseSpec(body);
    if (spec.text.trim() === '') {
      return NextResponse.json({ error: "The label text is empty" }, { status: 400 });
    }

    const db = await getDb();
    
    // Save to database
    await db.collection("saved_labels").insertOne({
      userId,
      spec,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving label:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
