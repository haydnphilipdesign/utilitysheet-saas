import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import SellerFormPage from '@/app/s/[token]/page';

// Isolated browser bundle of the real seller page: no Next server, database or
// provider. The spec intercepts every request this page makes.
const token = window.location.pathname.split('/').filter(Boolean).pop() || 'synthetic-token';
const params = Promise.resolve({ token });

createRoot(document.getElementById('root')!).render(
    <Suspense fallback={null}>
        <SellerFormPage params={params} />
    </Suspense>
);
