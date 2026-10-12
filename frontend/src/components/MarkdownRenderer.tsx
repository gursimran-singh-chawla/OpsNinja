import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose-clean max-w-none text-xs text-slate-800 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-bold text-ink mt-3 mb-2 pb-1 border-b border-border/70 flex items-center gap-1.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-bold text-ink mt-4 mb-2 pb-1 border-b border-border/50 flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-bold text-indigo-950 mt-3.5 mb-1.5 flex items-center gap-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-3 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-xs text-slate-700 leading-relaxed my-2">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1.5 text-xs text-slate-700 marker:text-indigo-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1.5 text-xs text-slate-700 marker:font-semibold marker:text-indigo-600">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1 leading-relaxed">
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div className="my-3 w-full overflow-x-auto rounded-lg border border-border shadow-2xs">
              <table className="w-full min-w-[480px] divide-y divide-border text-left text-xs text-ink">
                {children}
              </table>
            </div>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100 font-mono">
              {children}
            </pre>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 font-semibold text-slate-700 text-[11px] uppercase tracking-wider border-b border-border">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/60 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/70 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2 font-semibold text-slate-700 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-slate-800 leading-normal whitespace-normal align-top">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-indigo-400 bg-indigo-50/60 rounded-r-lg px-4 py-2.5 text-xs text-slate-800">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-4 border-t border-border/80" />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-800">
              {children}
            </em>
          ),
          code: ({ children }) => (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 border border-slate-200/70">
              {children}
            </code>
          ),
          a: ({ href, children }) => {
            const isSafe =
              Boolean(href) &&
              (href!.startsWith("http://") ||
                href!.startsWith("https://") ||
                href!.startsWith("/") ||
                href!.startsWith("#"));
            if (!isSafe) {
              return <span>{children}</span>;
            }
            return (
              <a
                href={href}
                target={href!.startsWith("http") ? "_blank" : undefined}
                rel={href!.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-brand font-medium underline hover:text-brand-hover transition-colors"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
