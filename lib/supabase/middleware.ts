import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    // If Supabase is not configured, allow all routes (demo mode)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        // In demo mode, redirect root to dashboard
        if (request.nextUrl.pathname === '/') {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protected routes check
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
    const isPublicRoute =
        request.nextUrl.pathname.startsWith('/s/') ||
        request.nextUrl.pathname.startsWith('/packet/');
    const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
    const isRootRoute = request.nextUrl.pathname === '/';

    // Redirect unauthenticated users from dashboard
    if (!user && isDashboardRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users from auth pages to dashboard
    if (user && isAuthRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // Redirect root to dashboard if authenticated, otherwise to login
    if (isRootRoute) {
        const url = request.nextUrl.clone();
        url.pathname = user ? '/dashboard' : '/auth/login';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
