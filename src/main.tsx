import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/mobile.css';
import './styles/ai-surfaces.css';
import './styles/admin-portal.css';
import App from './App.tsx';

// Register Service Worker for PWA offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(reg => {
        console.log('✓ Building Mistry Service Worker active:', reg.scope);
      })
      .catch(err => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

// Ensure persistent local storage on mobile devices (prevents Android OS eviction)
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(persistent => {
    if (persistent) {
      console.log('✓ Storage is persistent. Dexie IndexedDB records will not be purged.');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

