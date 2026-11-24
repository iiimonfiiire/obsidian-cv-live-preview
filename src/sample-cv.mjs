// The note "Create sample CV" writes. All content is placeholder; edit the sample here only.
export const SAMPLE_CV = `---
name: Daniel Carcharias
headline: Knowledge Architect + Technical Writer
email: daniel.carcharias@example.com
phone: 000-000-0000
linkedin: https://www.linkedin.com/in/example
github: https://github.com/example
website: https://example.com | Portfolio
---

If I do my job well, nobody has to ask me anything twice. I build knowledge bases that readers trust and AI answers from, and I once taught a help center to admit when it does not know. Looking for a team that treats documentation as product infrastructure and keeps the coffee supply stable.

## Experience

### Nimbus Data Sentinels · Senior Technical Writer · 12/2025 – 08/2026

- Built the docs team's Claude Code plugin, so the style guide now reads drafts before the humans do.
- Owned three product domains and quietly absorbed about two thirds of incoming ticket volume. The tickets never saw it coming.
- Wrote KB articles, release notes, and deployment guides for databases that nobody volunteers to install.
- Built a staging and live-preview layer with Git backups for the help center, **so publishing finally has an undo button**.

### Perimeter Radar · Knowledge Manager, Technical Writer, Customer Enablement Lead · 05/2021 – 12/2025

- Built the knowledge base from a blank page, gave it a voice, and moved it into the product where users already were.
- Co-built an AI search feature that answers from the docs, then turned 100+ thumbs-down ratings into 20 targeted fixes to **cut confident but wrong answers**.
- Owned the public API docs: read every word, wrote the example scripts, and taught the in-app assistant where to point.
- Cut weekly release notes from 1 day to \\<1 hour with an AI-assisted pipeline and review gates, **freeing a fifth of the week**.
- Added an in-app help menu, **cutting email tickets by about a third** in 3 months. The inbox sent a thank-you card.
- Built announcement templates so breach notices ship in hours, not days. The most-read one had almost as many clicks as views.
- Shipped UX microcopy through Git, **so a typo fix takes minutes, not a sprint**.

### Echo Chamber Audio · Technical Documentation Manager · 11/2020 – 05/2021

- Wrote manuals, service guides, and white papers for gadgets that make sound, and for the people who plug them in backwards.
- Evaluated the in-house audio technology by critical listening and measurement, then reported the results in **evaluation reports with graphs**.
- Kept Product, QA, and Operations in agreement. Mostly.

### Decibel Dynamics · Product Manager · 10/2014 – 11/2020

- Managed accounts for household-name tech companies, turning their requirements into product definitions that took an audio suite to **20+ devices and platforms**.
- Set the standard for PRDs, wireframes, and tuning reports across Android, Linux, Windows, and embedded DSP.
- Shipped on tight schedules with teams in three countries and at least four definitions of "done".
- Produced demos and marketing copy for two trade shows, one of them with a lot of carpet.

## Projects

### [Style Guide Toolkit](https://example.com/style-guide-toolkit) · 08/2026 – Present

A starter kit for docs teams: a style guide for clear, scannable writing, plus skills, agents, and hooks that apply it before anyone hits publish.

### [Stack Sniffer](https://example.com/stack-sniffer) · 11/2026 – Present

A browser extension that reveals what powers a help center: platform, AI search, chat, analytics, and whether AI crawlers are welcome.

### [Doc Gym](https://example.com/doc-gym) · 09/2026 – Present

A tech-writing practice tool in Obsidian, powered by a local model on a home server that never complains about overtime.

## Skills

### Knowledge Systems + AI

Knowledge architecture, information architecture, Docs-as-Code, retrieval-augmented generation (RAG), Claude Code, Claude skills + plugins

### Tools + Collaboration

GitHub, Jira, Confluence, Zendesk, Pendo, MkDocs, GitBook, Swagger, HTML, CSS

### Fun fact

I play drums, bass, and a cello I am still negotiating with. Recruit me for your house band!

## Education

### M.Sc. · Music Engineering · Institute of Placeholder Studies · 08/2012 – 05/2014

### B.A. · Music Technology · Example State University · 10/2008 – 07/2012

### B.A. · English · Sample College · 08/2001 – 05/2005

## Languages

- English | Native
- Hebrew | Fluent
- French | Conversational
`;

// "Sample CV.md", then "Sample CV 2.md", "Sample CV 3.md", ... Never an existing path.
export function sampleCvPath(folderPath, exists) {
  const dir = String(folderPath ?? "").replace(/^\/+|\/+$/g, "");
  const at = (name) => (dir ? `${dir}/${name}.md` : `${name}.md`);
  let path = at("Sample CV");
  for (let n = 2; exists(path); n++) path = at(`Sample CV ${n}`);
  return path;
}
