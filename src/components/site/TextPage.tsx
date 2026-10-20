import { Markdown } from './Markdown';

export function TextPage({ title, body, fallback }: { title: string; body: string; fallback?: string }) {
  return (
    <div className="container-site max-w-3xl py-10">
      <h1 className="h1">{title}</h1>
      <div className="card mt-6 p-6">
        {body ? <Markdown source={body} /> : <p className="text-slate-500">{fallback}</p>}
      </div>
    </div>
  );
}
