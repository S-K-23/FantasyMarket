import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

const RSS_FEEDS: Record<string, string[]> = {
    'Sports': [
        'https://www.espn.com/espn/rss/news',
        'https://sports.yahoo.com/rss/'
    ],
    'Politics': [
        'http://rss.cnn.com/rss/cnn_allpolitics.rss',
        'https://feeds.npr.org/1014/rss.xml'
    ],
    'Crypto': [
        'https://www.coindesk.com/arc/outboundfeeds/rss/',
        'https://cointelegraph.com/rss'
    ],
    'Business': [
        'https://feeds.content.dowjones.io/public/rss/mw_topstories',
        'https://www.cnbc.com/id/10001147/device/rss/rss.html'
    ],
    'Science': [
        'https://www.sciencedaily.com/rss/top/science.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml'
    ],
    'Pop Culture': [
        'https://www.eonline.com/news/rss.xml',
        'https://people.com/feed.rss'
    ]
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'Pop Culture';

    const feeds = RSS_FEEDS[category] || RSS_FEEDS['Pop Culture'];

    try {
        const feedPromises = feeds.map(url => parser.parseURL(url));
        const results = await Promise.allSettled(feedPromises);

        let allItems: any[] = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allItems = [...allItems, ...result.value.items];
            }
        });

        // Sort by date (newest first) and take top 10
        const sortedNews = allItems
            .sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime())
            .slice(0, 10)
            .map(item => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                source: item.creator || 'News Source'
            }));

        return NextResponse.json({ news: sortedNews });
    } catch (error) {
        console.error('Error fetching news:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
