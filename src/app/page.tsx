"use client";
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import Sidebar from '@/components/Sidebar/Sidebar';
import VideoCard, { VideoCardSkeleton } from '@/components/VideoCard/VideoCard';
import { categories } from '@/data/dummyData';
import { apiClient } from '@/utils/api';
import useVideoStore from '@/store/videoStore';
import '@/pages/Home.css';

const Home = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { videos, setVideos, homeCategory, setHomeCategory } = useVideoStore();
  const [loading, setLoading] = useState(videos.length === 0);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch initial page
  useEffect(() => {
    const fetchInitialVideos = async () => {
      setLoading(true);
      setPage(1);
      setHasMore(true);
      try {
        const data = await apiClient.get(`/videos?category=${encodeURIComponent(homeCategory)}&page=1&limit=20`);
        setVideos(data);
        if (data.length < 20) {
          setHasMore(false);
        }
      } catch (err) {
        console.error('Error fetching initial videos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialVideos();
  }, [homeCategory, setVideos]);

  // Load more videos when scrolling
  const loadMoreVideos = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await apiClient.get(`/videos?category=${encodeURIComponent(homeCategory)}&page=${nextPage}&limit=20`);
      if (data.length > 0) {
        setVideos(prev => {
          // Deduplicate just in case
          const existingIds = new Set(prev.map(v => v.id));
          const newVideos = data.filter(v => !existingIds.has(v.id));
          return [...prev, ...newVideos];
        });
        setPage(nextPage);
        if (data.length < 20) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more videos:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Scroll listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const threshold = 150; // px from bottom
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.scrollHeight - threshold) {
        loadMoreVideos();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [page, hasMore, loadingMore, homeCategory]);

  // Real-time polling for pending videos
  useEffect(() => {
    let interval = null;
    const hasPending = videos.some(v => v.status === 'Pending');
    
    if (hasPending) {
      interval = setInterval(async () => {
        try {
          const data = await apiClient.get(`/videos?category=${encodeURIComponent(homeCategory)}&page=1&limit=${page * 20}`);
          setVideos(data);
        } catch (err) {
          console.error('Error polling pending video status:', err);
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videos, homeCategory, page, setVideos]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const filteredVideos = videos;

  return (
    <div className="home">
      <Navbar onMenuClick={toggleSidebar} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="category-chips">
          {categories.map((category) => (
             <button
              key={category.id}
              className={`category-chip ${homeCategory === category.name ? 'active' : ''}`}
              onClick={() => {
                if (homeCategory !== category.name) {
                  setVideos([]);
                  setHomeCategory(category.name);
                }
              }}
            >
              <span>{category.name}</span>
            </button>
          ))}
        </div>

        <div className="video-grid">
          {loading ? (
            Array(8).fill(null).map((_, i) => <VideoCardSkeleton key={i} />)
          ) : (
            filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
