import { href } from '../router'
import { Card, CardContent } from './ui/card'

export function StatCard({ label, value, to, tone }: { label: string; value: number; to: string; tone?: 'red' }) {
  return (
    <a href={href(to)} className="block">
      <Card className="transition-colors hover:border-ring">
        <CardContent className="p-4">
          <div className={`text-3xl font-semibold ${tone === 'red' && value > 0 ? 'text-destructive' : ''}`}>
            {value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </a>
  )
}
