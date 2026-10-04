import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { MockDomainProvider } from './mock/domain';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MockDomainProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MockDomainProvider>
  </StrictMode>,
);
