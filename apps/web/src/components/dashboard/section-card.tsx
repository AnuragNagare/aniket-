import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

type Props = {
  title: string;
  action?: { href: string; label: string };
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** Dashboard panel: title row (with an optional link or chip) above its content. */
export function SectionCard({ title, action, aside, className, children }: Props) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        {aside}
        {action ? (
          <Link href={action.href} className="text-sm font-semibold text-brand-700 hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
