import { NextRequest, NextResponse } from "next/server";
import { upsertUserAndCreateSession, generateAuthToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { googleAccessToken } = await req.json();
    if (!googleAccessToken) {
      return NextResponse.json({ error: "Missing googleAccessToken" }, { status: 400 });
    }

    const url = new URL('https://www.googleapis.com/oauth2/v3/userinfo');
    url.searchParams.append('access_token', googleAccessToken);

    const userInfoResponse = await fetch(url.toString());
    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      return NextResponse.json({
        error: userInfo.error_description || "Invalid access token"
      }, { status: 401 });
    }

    const { sub, email, name } = userInfo;

    if (!sub || !email || !name) {
      return NextResponse.json({
        error: "Incomplete user profile from Google",
        isSub: !!sub,
        isEmail: !!email,
      }, { status: 400 });
    }

    // Create or update user in database
    const { userId, tokenId, roles } = await upsertUserAndCreateSession(sub, email, name);

    const authToken = generateAuthToken(tokenId, userId, roles);

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
