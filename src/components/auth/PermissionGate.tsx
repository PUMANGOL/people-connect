import type { ReactNode } from 'react';
import { usePermission } from '@/src/hooks';
import type { Resource, Action } from '@/src/lib/permissions';

interface PermissionGateProps {
  resource: Resource;
  action?: Action;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ resource, action = 'view', children, fallback = null }: PermissionGateProps) {
  const allowed = usePermission(resource, action);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
