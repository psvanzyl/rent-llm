import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      isAdmin: isAdminEmail(user.email),
    },
  });
};

export const GET = jsonRoute("auth-me", { GET: handler_GET });
