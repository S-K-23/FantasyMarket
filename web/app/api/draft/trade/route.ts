import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pickId, fromPlayer, toPlayer } = body;

        if (!pickId || !fromPlayer || !toPlayer) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Verify the pick exists and belongs to the fromPlayer
        const pick = await prisma.draftPick.findUnique({
            where: { id: pickId }
        });

        if (!pick) {
            return NextResponse.json(
                { error: 'Pick not found' },
                { status: 404 }
            );
        }

        if (pick.player !== fromPlayer) {
            return NextResponse.json(
                { error: 'You do not own this pick' },
                { status: 403 }
            );
        }

        // Update the pick owner
        const updatedPick = await prisma.draftPick.update({
            where: { id: pickId },
            data: { player: toPlayer }
        });

        return NextResponse.json({ pick: updatedPick });

    } catch (error) {
        console.error('Trade error:', error);
        return NextResponse.json(
            { error: 'Failed to process trade' },
            { status: 500 }
        );
    }
}
