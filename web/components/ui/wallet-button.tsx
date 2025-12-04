'use client';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
    return <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !h-10 !px-4 !py-2 !rounded-md !font-medium" />;
}
