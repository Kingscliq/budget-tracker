# Pocket intelligence and voice roadmap

Status — proposal for a future phase. The current delivery adds descriptions to expenses and payments. Voice and AI features are planned work.

## Product direction

Let people explain their spending in their own words, understand their budget, and perform Pocket actions through a voice assistant. Keep the existing forms available as the foundation for every action.

Descriptions provide context for this direction. An expense description explains its monthly purpose, such as “Weekly groceries and household essentials”. A payment description explains one spend, such as “Rice and vegetables at the market”. Keep these fields separate so future insights can distinguish a budget target from its transactions.

## Phase 1 — reliable descriptions

- Add optional descriptions to expense creation and editing, and to each new payment.
- Show expense context in the monthly plan. Show spend context in Transactions and each expense’s payment history.
- Preserve descriptions through local storage, optional cloud sync, JSON backups, CSV export, and copying recurring expense plans into another month.
- Validate plain text up to 1,000 characters. Existing records can omit descriptions.
- Keep description text out of usage analytics.
- Start payment amounts empty and show the remaining planned amount as a compact limit hint. Validate each new payment against that remaining amount.

Future work can add payment editing, description search across all transactions, and a chronological change log if users need them. The description field is contextual text rather than a record of every historical edit.

## Phase 2 — useful budget intelligence

Start with calculations that Pocket can explain directly from recorded data.

- Summarize planned expenses, payments, pending amounts, savings contributions, and remaining budget.
- Surface overspent items, approaching budget limits, and recurring payments that remain pending.
- Compare months with the same currency. Keep recorded currencies explicit in every answer.
- Suggest categories and recognizable expense names from descriptions. Present suggestions for user review.
- Answer questions such as “What did I spend on groceries this month?” with amounts calculated by Pocket and links to the supporting payments.

Use a language model to interpret wording and explain results. Use the existing money and totals functions for arithmetic. Give descriptions and other user text the role of data so a note cannot authorize commands or change assistant instructions.

## Phase 3 — one command layer for forms, text, and voice

Before introducing voice writes, extract the existing budget mutations into a shared, typed command interface. Route each entry point through the same validation and persistence behavior.

| Area | Commands and behavior |
| --- | --- |
| Months | Open a month, create a month, copy a recurring plan |
| Income | Set the selected month’s income |
| Expenses | Create, edit, cancel, restore, or delete an expense |
| Payments | Record a spend with amount, date, and description, view history, remove a payment |
| Savings and forex | Use ordinary expense/payment commands with the appropriate category |
| Currency | Select a currency for the chosen month and explain the label change before applying it |
| Navigation | Open Overview, Savings, Transactions, Settings, and the tour, apply supported filters and search |
| Files | Export CSV, download a backup, guide the user through choosing a restore file |
| Sync | Open optional email verification, show the available budget copies, enable or disconnect sync through the existing flow |

Each command carries an explicit budget ID. Expense and payment IDs come from local lookup after name resolution. Monetary inputs become validated integer minor units. Payment drafts respect the remaining planned amount. When a spend would exceed it, guide the user to review the expense’s planned amount. Date resolution uses the user’s active time zone and a captured current date. Return a structured success or error result that the UI can display and the assistant can explain.

For writes, show a review card with the resolved month, currency, expense, amount, date, and description. Execute after the user confirms. Read-only navigation and budget questions can proceed immediately. File selection, email verification, and cloud-copy replacement remain visible UI steps that the assistant can guide.

## Phase 4 — voice capture and conversation

A proposed interaction follows this sequence.

1. The user taps a microphone button and grants microphone access.
2. The app displays a clear recording indicator and a stop button.
3. A transcription adapter produces editable text. Choose the speech provider after testing supported browsers, accents, device performance, latency, and cost.
4. The assistant resolves the transcript into a supported command or a question. Send only the budget context needed for that request to the selected AI service, with an explicit opt-in explanation.
5. Ask a short clarification when an expense name, amount, currency, date, or month is ambiguous.
6. Show the review card for a write, apply the confirmed command once, and announce the result. Offer optional spoken responses.

Begin with tap-to-talk and a typed fallback. Test Nigerian English, naira amounts, common local merchant names, noisy rooms, and mobile interruptions before expanding the experience.

### Example journeys

| Request | Expected outcome |
| --- | --- |
| “Add transport with a budget of 40,000, for work commutes” | Draft a new Transport expense for the active month with the description “Work commutes” |
| “Log 12,500 on Food for rice and vegetables today” | Resolve Food, show its currency and today’s date, and draft a payment with that description |
| “I spent five on food” | Ask for the exact amount before creating a draft |
| “What have I spent on food?” | Calculate Food’s recorded payments and show the transactions supporting the answer |
| “Cancel my X subscription this month” | Review cancellation of the resolved item and explain the unpaid allocation being released |
| “Delete that payment” | Resolve the referenced payment and request a visible confirmation |
| “Use my budget on my phone” | Open sync setup and guide the existing verification and copy-selection steps |

## Architecture and failure handling

The client owns microphone controls, transcript editing, command previews, local budget lookup, and the existing persistence flow. A server endpoint can call the chosen AI provider with server-held credentials and return a validated intent. Keep provider-specific speech and model code behind adapters so it can be changed independently of budget behavior.

Preserve Pocket’s device-only entry point. Cloud sync continues to use Supabase authentication, row ownership, and revision checks. If a cloud write fails after the local save, explain that state accurately and retain the local work.

Give each confirmed write a command ID and prevent duplicate application when a speech callback, network retry, or repeated confirmation occurs. Bind confirmations to the exact draft and budget revision. Re-review when the month or relevant record changes. A failed request should leave an editable draft and a clear retry action.

Release the microphone on stop, cancellation, navigation, and component teardown. Discard raw audio after transcription by default. Describe any chosen provider retention behavior during implementation. Usage analytics can record fixed events such as voice started or command confirmed, while excluding recordings, transcripts, descriptions, emails, and budget values.

## Suggested delivery order

1. Ship descriptions and gather examples of how people use them.
2. Extract shared commands and implement deterministic budget summaries.
3. Add a typed assistant for read-only questions and navigation.
4. Add tap-to-talk transcription and editable transcripts.
5. Add reviewed expense and payment creation through voice.
6. Expand to the remaining command table, then optional spoken responses.

## Acceptance checks for the future assistant

- Every supported command has a normal form/UI path and a voice journey test.
- Ambiguous names and amounts produce clarification instead of a write.
- Repeated callbacks and retries create one confirmed payment.
- Month changes, stale cloud revisions, offline transitions, and recording interruptions preserve a consistent local budget.
- Spoken money, fractional amounts, dates, and currencies resolve correctly before confirmation.
- Screen readers, keyboard controls, and mobile touch targets can complete recording, review, confirmation, and cancellation.
- Descriptions, transcripts, audio, and financial details remain excluded from usage analytics.
- Deployment requires an explicit provider choice, tested latency and cost limits, request limits, and a clear explanation of what data reaches that provider.
