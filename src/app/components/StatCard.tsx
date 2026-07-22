import { href } from '../router'
import { Card, CardContent } from './ui/card'

export function StatCard({ label, value, to, tone }: { label: string; value: number; to: string; tone?: 'red' }) {
  return (
    <a href={href(to)} className="block">
      <Card className="transition hover:-translate-y-px hover:border-ring hover:shadow-raised">
        <CardContent className="p-4">
          {/* type utilities in plain strings — cn() would merge them as colors */}
          <div className={`font-display text-display ${tone === 'red' && value > 0 ? 'text-destructive' : ''}`}>
            {value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </a>
  )
}
