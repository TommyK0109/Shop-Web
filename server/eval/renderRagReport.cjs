const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../docs');
const artifact = (name) => JSON.parse(fs.readFileSync(path.join(root, 'rag-test-artifacts', name), 'utf8'));
const data = artifact('live-results.json');
const indexing = artifact('indexing.json');
const tests = artifact('server-tests.json');
const clientTests = artifact('client-tests.json');
const reviewPath = path.join(root, 'rag-test-artifacts', 'review.json');
const review = fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, 'utf8')) : { findings: [], cases: {} };
const rows = data.rows;
const count = (predicate) => rows.filter(predicate).length;
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const sum = (ledger, field) => ledger.reduce((total, item) => total + item[field], 0);
const delta = (field) => sum(data.after, field) - sum(data.before, field);
const esc = (value) => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const quoted = (value) => String(value).split(/\r?\n/).map((line) => '> ' + line).join('\n');
const secs = (ms) => (ms / 1000).toFixed(2) + ' s';
const status = (row) => row.response?.status ?? 'Error ' + row.error.status;
const lines = [];
const add = (...items) => lines.push(...items);
add('# RAG test results', '', 'Session date: 2026-10-04 (Asia/Saigon). Raw execution timestamps are preserved in the JSON artifact.', '',
  `Completed: **${rows.length}/50 live cases**. **${count(r => r.automatedResult === 'PASS')} passed automated checks; ${count(r => r.automatedResult === 'FAIL')} failed.** Automated checks cover expected statuses, labeled-product presence, budget/availability/visibility constraints and citation mapping; they are not a complete answer-quality score.`, '',
  `The existing deterministic server RAG suites also finished with **${tests.numPassedTests}/${tests.numTotalTests} tests passed**. These use real PostgreSQL/Redis where appropriate and provider doubles; they are separate from the 50 live cases.`, '',
  `Assistant UI and client contract tests: **${clientTests.numPassedTests}/${clientTests.numTotalTests} passed**. Server TypeScript checking also passed.`, '',
  '## Execution and scope', '',
  '- Isolated database: `localhost:55433/storefront_test`; isolated Redis: `localhost:16380`. The development catalog was not modified.',
  '- Corpus: 36 authored fictional products; ' + data.eligibleDocuments + ' eligible documents indexed using real Gemini embeddings. Archived products and suspended sellers are excluded from eligible coverage.',
  '- Models configured by the application: `' + data.embeddingModel + '` (1,536 dimensions) and `' + data.generationModel + '`.',
  '- Calls went through the existing `runRag(request, true)` service, its real hybrid retrieval SQL, grounding validation, provider adapter, Redis provider coordination and PostgreSQL usage ledger. Production RAG code and prompts were not changed.',
  '- This is a service-level live evaluation. Browser rendering, HTTP authentication and per-user HTTP rate limiting were not exercised by these 50 calls; relevant HTTP/limiter behavior is covered separately by the deterministic tests.',
  '- Cases comprise the 46 executable questions in the existing dataset (including eight held-out questions) plus four additional cases. Dataset q39/q40 are concurrent-mutation scenarios and are not counted as live Q&A; freshness races are covered by the deterministic integration suites.',
  '- Requests ran serially, with a seven-second pause after provider-using cases. Pauses are excluded from per-case latency. No evaluator retry was added; the application\'s own one-repair-attempt behavior remains active.',
  '- The answer text below is taken from returned structured responses. Product names, source mappings and comparison tables are rendered for readability; failed calls retain their actual error text. No substitute answers were written.', '',
  '## Summary', '', '| Measure | Result |', '|---|---|',
  `| Answered | ${count(r => r.response?.status === 'answered')} |`,
  `| Clarification requested | ${count(r => r.response?.status === 'clarification_needed')} |`,
  `| Insufficient evidence | ${count(r => r.response?.status === 'insufficient_evidence')} |`,
  `| Expected errors | ${count(r => r.error && r.error.status === r.question.expectedErrorStatus)} |`,
  `| Unexpected errors | ${count(r => r.error && r.error.status !== r.question.expectedErrorStatus)} |`,
  `| All-case latency p50 / p95 | ${secs(percentile(rows.map(r => r.durationMs), .5))} / ${secs(percentile(rows.map(r => r.durationMs), .95))} |`,
  `| Provider-using case latency p50 / p95 | ${secs(percentile(rows.filter(r => r.providerHttp.length).map(r => r.durationMs), .5))} / ${secs(percentile(rows.filter(r => r.providerHttp.length).map(r => r.durationMs), .95))} |`,
  `| Provider requests during evaluation | ${delta('calls')} |`,
  `| Reported input / output tokens during evaluation | ${delta('input_tokens')} / ${delta('output_tokens')} |`,
  `| Provider requests during corpus indexing | ${sum(indexing.after, 'calls') - sum(indexing.before, 'calls')} |`,
  '| Monetary cost | Not measured; request counts do not establish billing |', '',
  '## Reviewed findings', '', ...(review.findings.length ? review.findings.map(f => '- ' + f) : ['Qualitative review pending.']), '',
  '## Case index', '', '| # | Dataset ID | Question | Returned status | Automated check |', '|---|---|---|---|---|');
for (const row of rows) add(`| ${row.number} | ${row.question.id} | ${esc(row.question.query)} | ${status(row)} | ${row.automatedResult} |`);
add('', '## Questions and actual returned answers', '');
for (const row of rows) {
  const q = row.question;
  const res = row.response;
  add(`### ${row.number}. ${q.id} — ${q.kind}`, '', '**Question**', '', quoted(q.query), '',
    `**Mode:** ${q.mode ?? 'recommend'} | **Status:** ${status(row)} | **Latency:** ${secs(row.durationMs)} | **Automated check:** ${row.automatedResult}`, '');
  if (q.productKeys?.length) add('Selected product fixture(s): `' + q.productKeys.join('`, `') + '`.', '');
  if (q.filters) add('Explicit input filters: `' + JSON.stringify(q.filters) + '`.', '');
  add('Expected: ' + (q.expectedErrorStatus ? 'error ' + q.expectedErrorStatus : q.expectedStatus ?? 'Satisfy the product question and documented constraints') +
    (q.expectedKeys.length ? '; labeled relevant fixture(s): `' + q.expectedKeys.join('`, `') + '`' : '') + '.', '');
  if (q.reviewRequirement) add('Dataset review requirement: ' + q.reviewRequirement, '');
  if (row.checks.length) add('**Failed checks:** ' + row.checks.join('; '), '');
  if (review.cases[q.id]) add('**Review:** ' + review.cases[q.id], '');
  add('**Actual returned answer**', '');
  if (row.error) add(quoted(row.error.message), '', 'No answer was returned for this request.', '');
  if (res) {
    if (res.answer) {
      add(quoted(res.answer.intro), '');
      for (const rec of res.answer.recommendations) {
        const product = res.products.find(p => p.id === rec.productId);
        add('**' + (product?.name ?? rec.productId) + '**', '');
        for (const reason of rec.reasons) add(quoted(reason.text) + '\n>\n> Citation: ' + reason.sourceIds.join(', '), '');
        if (rec.unknowns.length) { add('Returned missing-information statements:', ''); for (const unknown of rec.unknowns) add(quoted(unknown), ''); }
      }
      if (res.answer.comparison.length) {
        const ids = res.answer.comparison[0].values.map(v => v.productId);
        add('| Attribute | ' + ids.map(id => esc(res.products.find(p => p.id === id)?.name ?? id)).join(' | ') + ' |', '|---|' + ids.map(() => '---|').join(''));
        for (const attribute of res.answer.comparison) add('| ' + esc(attribute.attribute) + ' | ' + ids.map(id => { const v = attribute.values.find(v => v.productId === id); return v ? esc(v.value) + ' [' + v.sourceIds.join(', ') + ']' : ''; }).join(' | ') + ' |');
        add('');
      }
      if (res.answer.followUpQuestion) add('Follow-up question:', '', quoted(res.answer.followUpQuestion), '');
    } else add('The response contained no generated answer.', '');
    if (res.sources.length) {
      add('**Returned sources and live product values**', '', '| Source | Product | Fixture | Price | Availability | Revision |', '|---|---|---|---|---|---|');
      for (const source of res.sources) {
        const p = res.products.find(p => p.id === source.productId);
        add(`| ${source.id} | ${esc(p.name)} | ${p.slug.replace(/^rag-demo-/, '')} | $${(p.priceCents / 100).toFixed(2)} | ${p.unavailableReason ?? 'Available to purchase'} | ${source.revision} |`);
      }
      add('');
    }
    add('Resolved filters: `' + JSON.stringify(res.filters) + '`.', '');
  }
  add('Provider HTTP results: ' + (row.providerHttp.length ? row.providerHttp.map(h => `${h.operation}: ${h.status}${h.providerStatus ? ' (' + h.providerStatus + ')' : ''}`).join('; ') : 'No provider call needed') + '.', '');
}
add('## Reproduction and artifacts', '',
  '- [Full requests, returned responses, errors and provider status metadata](rag-test-artifacts/live-results.json)',
  '- [Live indexing results](rag-test-artifacts/indexing.json)',
  '- [Deterministic RAG test results](rag-test-artifacts/server-tests.json)',
  '- [Assistant UI and client contract test results](rag-test-artifacts/client-tests.json)',
  '- [Qualitative review notes](rag-test-artifacts/review.json)', '',
  'From the repository root, with the configured key in `server/.env`:', '', '```powershell',
  '# Configure an isolated PostgreSQL database and Redis instance before these commands.',
  "$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:55433/storefront_test?schema=public'",
  "$env:REDIS_URL = 'redis://localhost:16380'", "$env:NODE_ENV = 'test'",
  'npm exec --workspace server -- prisma migrate deploy', 'npm run rag:demo --workspace server',
  'npm exec --workspace server -- tsx --conditions=development eval/runRagReport.ts --index',
  'npm exec --workspace server -- tsx --conditions=development eval/runRagReport.ts',
  'node server/eval/renderRagReport.cjs', '```', '',
  'These commands make live provider calls and overwrite these evaluation artifact filenames. Archive the artifacts before rerunning. Use the original dataset evaluator separately for retrieval Recall@5; this report measures final returned answers and does not claim pure retrieval recall or a baseline comparison.', '');
fs.writeFileSync(path.join(root, 'RAG-TEST-RESULTS.md'), lines.join('\n'));
console.log(JSON.stringify({ report: path.join(root, 'RAG-TEST-RESULTS.md'), cases: rows.length, pass: count(r => r.automatedResult === 'PASS'), fail: count(r => r.automatedResult === 'FAIL') }));
