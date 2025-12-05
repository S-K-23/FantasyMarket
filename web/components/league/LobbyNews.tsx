'use client';

import { useEffect, useState } from 'react';

interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

export default function LobbyNews({ category }: { category: string }) {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await fetch(`/api/news?category=${encodeURIComponent(category || 'Pop Culture')}`);
                const data = await res.json();
                if (data.news) {
                    setNews(data.news);
                }
            } catch (error) {
                console.error('Failed to fetch news:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [category]);

    if (loading) return <div className="animate-pulse h-40 bg-gray-800/50 rounded-xl"></div>;

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-gray-900/30">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    📰 {category} News
                </h3>
            </div>
            <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                {news.map((item, i) => (
                    <a
                        key={i}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 hover:bg-gray-700/30 transition group"
                    >
                        <h4 className="font-medium text-sm group-hover:text-blue-400 transition mb-1">
                            {item.title}
                        </h4>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>{item.source}</span>
                            <span>{new Date(item.pubDate).toLocaleDateString()}</span>
                        </div>
                    </a>
                ))}
                {news.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No news found for this category.
                    </div>
                )}
            </div>
        </div>
    );
}
