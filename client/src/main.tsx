import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initMobileErgonomics } from './utils/mobileErgonomics';

// Initialize mobile ergonomics (visualViewport, keyboard offset, safe areas)
initMobileErgonomics();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find root element');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
