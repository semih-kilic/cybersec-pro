import { createContext, useContext, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

/**
 * Tabs — accessible, animated tab system with shared layoutId pill indicator.
 *
 *   <Tabs defaultValue="overview">
 *     <TabsList>
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="alerts">Alerts</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">…</TabsContent>
 *     <TabsContent value="alerts">…</TabsContent>
 *   </Tabs>
 */

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  groupId: string;
}
const TabsCtx = createContext<TabsContextValue | null>(null);
function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue! : internal;
  const setValue = (v: string) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };
  const groupId = `vos-tabs-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <TabsCtx.Provider value={{ value, setValue, groupId }}>
      <div className={cn('flex flex-col gap-vos-4', className)}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-vos-full vos-glass-1 self-start',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, setValue, groupId } = useTabs();
  const isActive = active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => setValue(value)}
      className={cn(
        'relative px-vos-4 py-vos-2 text-vos-sm font-medium rounded-vos-full transition-colors duration-vos-2',
        isActive ? 'text-vos-text' : 'text-vos-text-3 hover:text-vos-text-2',
        className,
      )}
    >
      {isActive && (
        <motion.span
          layoutId={`${groupId}-indicator`}
          className="absolute inset-0 rounded-vos-full bg-vos-glass-3 border border-vos-border-3"
          style={{ boxShadow: 'var(--vos-highlight)' }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={cn('vos-rise-in', className)}>
      {children}
    </div>
  );
}
