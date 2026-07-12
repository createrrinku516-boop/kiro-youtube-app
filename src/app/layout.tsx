"use client";
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import useAuthStore from '@/store/authStore';
import { getCookie } from '@/utils/cookies';
import { initSmoothScroll } from '@/utils/smoothScroll';
import '../App.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [iframeKey, setIframeKey] = useState(0);
  const loadUser = useAuthStore(state => state.loadUser);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('[SW] ServiceWorker registration successful with scope: ', registration.scope);
        },
        (err) => {
          console.log('[SW] ServiceWorker registration failed: ', err);
        }
      );
    }
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const cleanup = initSmoothScroll();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? (localStorage.getItem('yt_theme') || getCookie('yt_theme') || 'dark') : 'dark';
    
    const applyTheme = (theme) => {
      let resolved = theme;
      if (theme === 'device' && typeof window !== 'undefined') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.body.setAttribute('data-theme', resolved);
    };

    applyTheme(savedTheme);
  }, []);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'YOUTUBE_PO_TOKEN') {
        const { poToken, visitorData } = e.data;
        window.youtubePoToken = poToken;
        window.youtubeVisitorData = visitorData;
        localStorage.setItem('youtube_po_token', poToken);
        localStorage.setItem('youtube_visitor_data', visitorData);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIframeKey(prev => prev + 1);
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const embedProxyUrl = `${API_BASE_URL}/videos/proxy/youtube-embed-proxy`;

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="App">
          {children}
          <iframe
            key={iframeKey}
            src={embedProxyUrl}
            style={{ display: 'none', width: 0, height: 0, border: 'none' }}
            title="youtube-token-generator"
          />
        </div>
      </body>
    </html>
  );
}
