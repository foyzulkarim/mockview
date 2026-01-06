'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SystemHealth, ServiceHealth } from '@/lib/types';

// Status indicator component
function StatusIndicator({ status }: { status: ServiceHealth['status'] }) {
  const colorClasses = {
    healthy: 'bg-green-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-yellow-500',
  };

  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${colorClasses[status]} animate-pulse`}
      title={status}
    />
  );
}

// Service card component
function ServiceCard({ service }: { service: ServiceHealth }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIndicator status={service.status} />
          <span className="font-medium text-white">{service.name}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {service.latency_ms !== undefined && (
            <span>{service.latency_ms}ms</span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-400 hover:text-blue-300"
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-sm">
          {service.error && (
            <div className="text-red-400 mb-2">
              <strong>Error:</strong> {service.error}
            </div>
          )}
          {service.details && (
            <div className="text-gray-400">
              <pre className="overflow-x-auto">
                {JSON.stringify(service.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Overall status badge
function OverallStatusBadge({ status }: { status: SystemHealth['overall'] }) {
  const config = {
    healthy: {
      bg: 'bg-green-900/50',
      border: 'border-green-500',
      text: 'text-green-400',
      label: 'All Systems Operational',
    },
    degraded: {
      bg: 'bg-yellow-900/50',
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      label: 'Partial Outage',
    },
    unhealthy: {
      bg: 'bg-red-900/50',
      border: 'border-red-500',
      text: 'text-red-400',
      label: 'Major Outage',
    },
  };

  const c = config[status];

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-6 text-center`}>
      <div className={`text-2xl font-bold ${c.text}`}>{c.label}</div>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();

      if (data.success) {
        setHealth(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch health status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, []);

  // Initial fetch and polling every 30 seconds
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">MockView Status</h1>
          <p className="text-gray-400">
            System health and service connectivity
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Checking services...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Health data */}
        {health && !loading && (
          <>
            {/* Overall status */}
            <div className="mb-8">
              <OverallStatusBadge status={health.overall} />
            </div>

            {/* Services list */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Services</h2>
              {health.services.map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>

            {/* Last update info */}
            {lastUpdate && (
              <div className="mt-8 text-center text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
                <button
                  onClick={fetchHealth}
                  className="ml-4 text-blue-400 hover:text-blue-300"
                >
                  Refresh
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-700 text-center text-sm text-gray-500">
          <p>MockView - AI-Powered Interview Preparation Platform</p>
          <p className="mt-2">
            <a href="/" className="text-blue-400 hover:text-blue-300">
              Back to Home
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
