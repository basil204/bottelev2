import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
    username: string;
    role: string;
    auth_version: number;
}

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-key-change-it'
);

export async function signJWT(payload: JWTPayload): Promise<string> {
    const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('3d')
        .sign(JWT_SECRET);
    return token;
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as JWTPayload;
    } catch (e) {
        return null;
    }
}
