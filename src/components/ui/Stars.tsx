import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarsProps {
  media: number;
  quantidade?: number;
  className?: string;
}

/** Nota em estrelas + quantidade de avaliações. */
export function Stars({ media, quantidade, className }: StarsProps) {
  const cheias = Math.round(media);
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i < cheias ? 'fill-amber-400 text-amber-400' : 'fill-navy-100 text-navy-100',
            )}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-navy-800">{media.toFixed(1)}</span>
      {quantidade !== undefined && (
        <span className="text-sm text-navy-400">
          ({quantidade} {quantidade === 1 ? 'avaliação' : 'avaliações'})
        </span>
      )}
    </span>
  );
}
