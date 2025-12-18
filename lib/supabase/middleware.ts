import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    // If Neon/Supabase Auth is not configured, allow all routes (demo mode)
    const isAuthConfigured = process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
        (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!isAuthConfigured) {
        // In demo mode, redirect root to dashboard
        // if (request.nextUrl.pathname === '/') {
        //     const url = request.nextUrl.clone();
        //     url.pathname = '/dashboard';
        //     return NextResponse.redirect(url);
        // }
        return NextResponse.next();
    }

    // Protected routes check
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
    const isPublicRoute =
        request.nextUrl.pathname.startsWith('/s/') ||
        request.nextUrl.pathname.startsWith('/packet/');
    const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
    const isOnboardingRoute = request.nextUrl.pathname.startsWith('/onboarding');
    const isRootRoute = request.nextUrl.pathname === '/';

    // Allow marketing page and public routes
    if (isRootRoute || isPublicRoute) {
        return NextResponse.next();
    }

    return NextResponse.next();
}
