import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'ga4_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const username = typeof body.username === 'string' ? body.username.trim() : ''
        const password = typeof body.password === 'string' ? body.password : ''

        const expectedUser = process.env.BASIC_AUTH_USER ?? ''
        const expectedPassword = process.env.BASIC_AUTH_PASSWORD ?? ''

        if (!expectedUser || !expectedPassword) {
            return NextResponse.json(
                { error: '認証が設定されていません' },
                { status: 500 }
            )
        }

        if (username !== expectedUser || password !== expectedPassword) {
            return NextResponse.json(
                { error: 'ユーザー名またはパスワードが正しくありません' },
                { status: 401 }
            )
        }

        const res = NextResponse.json({ ok: true })
        res.cookies.set(AUTH_COOKIE, '1', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: COOKIE_MAX_AGE,
            path: '/',
        })
        return res
    } catch {
        return NextResponse.json(
            { error: 'リクエストの処理に失敗しました' },
            { status: 400 }
        )
    }
}
