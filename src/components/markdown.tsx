import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown builds React elements (no innerHTML). Raw HTML in the source is not rendered
// (no rehype-raw), and the default urlTransform strips javascript:/data: links.
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a> }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
