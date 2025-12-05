import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch user profile by wallet address
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    try {
        let profile = await prisma.userProfile.findUnique({
            where: { address }
        });

        // Create profile if doesn't exist
        if (!profile) {
            profile = await prisma.userProfile.create({
                data: { address }
            });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create or update user profile
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { address } = body;

        if (!address) {
            return NextResponse.json({ error: 'Address required' }, { status: 400 });
        }

        const profile = await prisma.userProfile.upsert({
            where: { address },
            update: {},
            create: { address }
        });

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
