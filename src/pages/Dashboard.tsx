import { useAuth } from '@/hooks/useAuth';

export default function Dashboard() {
  const { profile } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Welcome back{profile ? `, ${profile.full_name}` : ''}.
      </p>
    </div>
  );
}
