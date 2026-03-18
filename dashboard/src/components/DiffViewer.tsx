interface Props {
  diff: string;
}

export function DiffViewer({ diff }: Props) {
  const lines = diff.split('\n');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <pre className="text-xs font-mono p-3 leading-5">
          {lines.map((line, i) => {
            let className = 'text-slate-400';
            let bg = '';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              className = 'text-emerald-400';
              bg = 'bg-emerald-500/5';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              className = 'text-red-400';
              bg = 'bg-red-500/5';
            } else if (line.startsWith('@@')) {
              className = 'text-blue-400';
              bg = 'bg-blue-500/5';
            } else if (line.startsWith('diff') || line.startsWith('index')) {
              className = 'text-slate-600';
            }

            return (
              <div key={i} className={`${bg} px-1 -mx-1`}>
                <span className={className}>{line}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
