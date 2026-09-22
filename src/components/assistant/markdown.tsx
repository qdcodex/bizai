import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant text as Markdown. react-markdown never renders raw HTML
 * by default (no `rehype-raw`), so this is safe against HTML/script
 * injection from model output or business data echoed back into the chat.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{children}</th>,
          td: ({ children }) => <td className="border-b px-2 py-1.5">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
