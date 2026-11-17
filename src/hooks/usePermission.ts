import { useAuthStore } from '@/src/store';
import { hasPermission, type Resource, type Action } from '@/src/lib/permissions';

export function usePermission(resource: Resource, action: Action = 'view'): boolean {
  const role = useAuthStore((s) => s.role);
  return hasPermission(role, resource, action);
}

export function useCanAccess(): (resource: Resource, action?: Action) => boolean {
  const role = useAuthStore((s) => s.role);
  return (resource: Resource, action: Action = 'view') => hasPermission(role, resource, action);
}
