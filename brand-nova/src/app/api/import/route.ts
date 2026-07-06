import { NextRequest, NextResponse } from "next/server";
import { importCsv } from "@/lib/csvImport";

export const maxDuration = 300; // large CSVs: MX checks take time

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "upload a CSV file as 'file'" }, { status: 400 });
  }
  const text = await file.text();
  try {
    const report = await importCsv(file.name, text);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "import failed" },
      { status: 400 }
    );
  }
}
