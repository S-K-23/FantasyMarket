import { NextRequest, NextResponse } from 'next/server';
import { runWeeklyUpdate } from '@/lib/cron/weekly-update';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        await runWeeklyUpdate();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
