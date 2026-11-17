'use client';

import dynamic from 'next/dynamic';
import { AppLoader } from './components/AppLoader';

const App = dynamic(() => import('./App'), {
  ssr: false,
  loading: () => <AppLoader />,
});

export function SpaShell() {
  return <App />;
}
