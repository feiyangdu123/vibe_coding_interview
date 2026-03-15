import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 保护 /admin 路由
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const sessionToken = request.cookies.get('sessionToken')?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 验证 session
    try {
      const res = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          Cookie: `sessionToken=${sessionToken}`
        }
      });

      if (!res.ok) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*'
};
