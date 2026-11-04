// Google Sign-In via OIDC ID tokens (GIS). We reuse the shared web client id.
// The client id is read from env GOOGLE_CLIENT_ID, falling back to the shared one.
export const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "1041745501470-vpofvf1si1gsrno5d39fi8oqn6k4rllg.apps.googleusercontent.com";

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

// Verify a Google ID token by calling Google's tokeninfo endpoint.
// Returns the profile or null on failure. Server-side only.
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: string | boolean;
      exp?: string;
    };
    if (!data.sub || !data.email) return null;
    if (data.aud !== GOOGLE_CLIENT_ID) return null;
    // check expiry
    if (data.exp && Number(data.exp) * 1000 < Date.now()) return null;
    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
      email_verified: data.email_verified === true || data.email_verified === "true",
    };
  } catch {
    return null;
  }
}
