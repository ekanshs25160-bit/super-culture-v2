import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search } from 'lucide-react';
import { PageHeader, EmptyState } from '../components/shared';

export default function FollowedView() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Followed Artists"
        meta="FEATURE INCOMING"
        subtitle="Subscribe to your favorite music producers, record labels, and sound artists."
      />

      <EmptyState
        icon={Users}
        title="Followed Artists Not Available Yet"
        description="Artist following, new release alerts, and curated discography feeds are scheduled for the next backend release."
        missingEndpoint="GET /api/library/artists"
        actionLabel="Search Artists"
        onAction={() => navigate('/search')}
      />
    </div>
  );
}
