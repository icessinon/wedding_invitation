import { NextResponse } from 'next/server'

const AUTH_COOKIE = 'ga4_auth'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(AUTH_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    })
    return res
}
