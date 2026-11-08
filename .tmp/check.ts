import { parseMessageContent } from "./src/core/parsing/parseMessage"
import { parseInlineMarkdown } from "./src/core/parsing/inlineMarkdown"

const md = `Revenue grew **34%** in Q4.

| Region | Revenue (USD) | Share (%) |
| --- | --- | --- |
| **EMEA** | 1,240,000 | 42% |
| APAC | 980,500 | 33% |

\`\`\`mermaid
xychart-beta
    title "Monthly revenue grew 34%"
    x-axis "Month" ["Jan","Feb","Mar"]
    y-axis "Revenue (USD thousands)" 0 --> 260
    bar [120,138,149]
\`\`\`

Done.`

const blocks = parseMessageContent(md)
console.log("blocks:", blocks.map(b => b.type).join(","))
for (const b of blocks) {
  if (b.type === "table") console.log("table headers:", JSON.stringify(b.headers), "rows:", b.rows.length, "cell0:", JSON.stringify(b.rows[0][0]))
  if (b.type === "mermaid") console.log("mermaid starts:", b.code.split("\n")[0])
}
console.log("inline bold:", JSON.stringify(parseInlineMarkdown("**EMEA**")))
console.log("inline mixed:", JSON.stringify(parseInlineMarkdown("up **34%** vs `x`")))
