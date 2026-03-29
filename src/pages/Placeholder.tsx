import { useLocation } from 'react-router-dom';

export default function Placeholder() {
  const { pathname } = useLocation();
  const title = pathname.split('/').filter(Boolean).pop() || 'Page';
  const formatted = title.charAt(0).toUpperCase() + title.slice(1).replace(/-/g, ' ');

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{formatted}</h1>
      <p className="mt-1 text-muted-foreground">This page is under construction.</p>
    </div>
  );
}
