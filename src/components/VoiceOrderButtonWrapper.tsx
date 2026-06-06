'use client';

import dynamic from 'next/dynamic';

const VoiceOrderButton = dynamic(() => import('@/components/VoiceOrderButton'), { ssr: false });

export default function VoiceOrderButtonWrapper() {
    return <VoiceOrderButton />;
}
