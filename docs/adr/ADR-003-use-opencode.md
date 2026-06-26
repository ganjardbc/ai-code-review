# ADR-003: Use OpenCode AI Model via 9Router Gateway

## Context
Automated code reviews require an AI model that:
1. Understands code syntax, logic, and patterns in multiple programming languages.
2. Follows formatting rules and returns responses strictly in JSON.
3. Keeps operating costs reasonable.
4. Integrates easily via an API.

## Decision
We will use the **OpenCode** model, accessed via the **9Router** API gateway.

## Alternatives Considered
1. **OpenAI GPT-4 / Anthropic Claude**: Leading commercial models with excellent coding capabilities, but they can be expensive at scale and lock the project into a single provider's proprietary ecosystem.
2. **Local Llama/DeepSeek (Self-Hosted)**: Provides maximum privacy and zero API costs, but requires substantial GPU hardware resources, which violates our goal of keeping the MVP lightweight and easy to deploy on standard virtual machines.

## Consequences
* **Cost & Performance Balance**: OpenCode is optimized for software engineering tasks and offers a cost-effective alternative to larger commercial models.
* **Unified API Gateway**: Using 9Router as a gateway allows us to switch the underlying AI model (e.g. to a different open-source model or a private endpoint) by simply updating a configuration variable, without changing application source code.
* **JSON Schema Support**: OpenCode via 9Router supports structured JSON output configurations, guaranteeing that we receive structured reviews instead of conversational markdown.
