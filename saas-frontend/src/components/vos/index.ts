/**
 * 🪟 Vision OS Component Primitives — Public API
 *
 * Import everything from a single namespace:
 *   import { Card, Button, Input, Badge, Skeleton, EmptyState, ... } from '@/components/vos';
 *
 * All primitives use the `--vos-*` design tokens declared in
 * src/styles/visionos-theme.css. They are framework-agnostic in spirit
 * (no business logic) and safe to compose freely.
 */

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
export { Button, type ButtonProps } from './Button';
export { Input, Textarea, type InputProps, type TextareaProps } from './Input';
export { Badge, SeverityBadge, type BadgeProps } from './Badge';
export { Chip } from './Chip';
export { Skeleton, SkeletonText, SkeletonCard } from './Skeleton';
export { EmptyState } from './EmptyState';
export { Sheet, SheetHeader, SheetBody, SheetFooter } from './Sheet';
export { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
export { PageTransition, StaggerChildren } from './PageTransition';
export { DataTable, type DataTableColumn } from './DataTable';
export { Stat, StatGroup } from './Stat';
export { Divider } from './Divider';
export { Tooltip } from './Tooltip';
export { Spinner } from './Spinner';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export { Switch } from './Switch';
export { Avatar } from './Avatar';
