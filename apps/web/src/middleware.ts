import { NextResponse, type NextRequest } from 'next/server'

// payload-totp читает путь из заголовка, иначе в админке бесконечный редирект на ввод кода.
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.append('x-pathname', request.nextUrl.pathname)
  return response
}

export const config = { matcher: ['/admin/:path*'] }
