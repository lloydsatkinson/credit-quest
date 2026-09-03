import { NextResponse } from "next/server";
import {
  PartnerIntakeError,
  processPartnerDeclineIntake,
} from "@/lib/server/partner-intake-service";

export async function POST(request: Request) {
  const bodyText = await request.text();

  try {
    const result = await processPartnerDeclineIntake({
      bodyText,
      headers: request.headers,
      now: new Date(),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PartnerIntakeError) {
      if (error.status === 400) {
        return NextResponse.json({ error: "Invalid partner decline request" }, { status: 400 });
      }
      if (error.status === 401) {
        return NextResponse.json({ error: "Partner request rejected" }, { status: 401 });
      }
      if (error.status === 429) {
        return NextResponse.json({ error: "Partner request rate limited" }, { status: 429 });
      }
      return NextResponse.json({ error: "Partner decline intake is unavailable" }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Could not create partner decline intake" },
      { status: 500 },
    );
  }
}
