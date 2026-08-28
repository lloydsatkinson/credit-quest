-- V2.1 Academy launch curriculum.
-- Controlled seed: these rows were editorially reviewed before being published.

insert into public.academy_articles (
  content_key,
  slug,
  version,
  status,
  supersedes_id,
  title,
  summary_20s,
  body_markdown,
  reading_minutes,
  topic_tags,
  audiences,
  mission_keys,
  barrier_types,
  passport_pillars,
  readiness_states,
  safety_tags,
  sensitivity,
  source_name,
  source_url,
  reviewer,
  reviewed_at,
  review_due_at,
  published_at
) values
(
  'credit-file-basics', 'what-is-a-credit-file', 1, 'published', null,
  'What is a credit file?',
  'A credit file records credit-related information about you. Lenders may use it as one input, but it is not itself a lending decision.',
  $body$## The short version
A credit file can include credit accounts, payment history, credit searches and some public-record information. Credit reference agencies collect and organise this information.

## What it does not do
Your file does not approve or decline you. Each lender applies its own criteria and may use information beyond a credit file.

## Useful habit
Check that the information held about you is accurate and focus on stable payment and application habits rather than chasing a single number.$body$,
  2, array['credit-file','basics']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array[]::text[], array[]::text[], array['general']::text[],
  'standard', 'MoneyHelper / ICO', 'https://ico.org.uk/for-the-public/credit/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'uk-credit-reference-agencies', 'uk-credit-reference-agencies', 1, 'published', null,
  'The UK credit reference agencies',
  'UK credit reference agencies hold credit-file information, but they do not make lending decisions for banks and other credit providers.',
  $body$## Who holds credit-file data?
The UK has several credit reference agencies. A lender may use data from one or more of them, so information and scores can differ between services.

## Why that matters
A score shown by a credit reference agency is a consumer-facing summary of its data. It is not the same as a lender's underwriting decision.

If information on your file is wrong, use the agency's dispute process and keep evidence of the correction you are requesting.$body$,
  2, array['credit-file','cra']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array[]::text[], array[]::text[], array['general']::text[],
  'standard', 'ICO', 'https://ico.org.uk/for-the-public/credit/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'credit-scores-vs-lender-decisions', 'credit-scores-vs-lender-decisions', 1, 'published', null,
  'A credit score is not a lender decision',
  'The score you see is a useful indicator, not an approval promise. Lenders use their own policies, data and affordability checks.',
  $body$## Two different things
A consumer credit score summarises information using the scoring model of the service showing it. A lender can use a different scorecard, different data and its own product rules.

## What to do instead
Treat a score as one signal. Concentrate on accurate data, on-time payments, sensible use of existing credit and avoiding unnecessary applications.

Credit Quest never converts its own Quest Score into a prediction that a lender will approve you.$body$,
  2, array['scores','lender-decisions']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array[]::text[], array[]::text[], array['general']::text[],
  'standard', 'MoneyHelper / ICO', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'beyond-the-score', 'what-lenders-may-look-at-beyond-a-score', 1, 'published', null,
  'What lenders may look at beyond a score',
  'Credit decisions can use more than a bureau score, including application information, existing commitments and the lender''s own risk rules.',
  $body$## A broader decision
Lenders can consider information from your application, credit file, existing relationship and affordability assessment. The exact mix varies by lender and product.

## Avoid universal rules
There is no single Credit Quest threshold that guarantees acceptance. Improving one metric can help your overall position without creating a guaranteed outcome.

Use soft-search eligibility tools where appropriate before deciding whether a hard application is worthwhile.$body$,
  2, array['scores','underwriting']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array['application_readiness']::text[], array[]::text[], array['general']::text[],
  'regulated_adjacent', 'MoneyHelper / FCA', 'https://www.fca.org.uk/consumers/credit-loans-debt', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'utilisation-basics', 'what-credit-utilisation-means', 1, 'published', null,
  'What credit utilisation means',
  'Credit utilisation is the share of your revolving credit limit currently in use. It is one useful headroom signal, not a universal lender cutoff.',
  $body$## The basic calculation
For a credit card, utilisation compares the balance being used with the available credit limit. Across several cards, an overall figure can also be calculated from total balances and limits.

## Why Credit Quest tracks it
High use can leave less financial headroom. Reducing balances where affordable can improve that headroom without needing a new account.

Credit Quest uses internal planning bands to organise missions. Those bands are not lender approval thresholds.$body$,
  2, array['utilisation','headroom']::text[], array['adult']::text[], array['reduce-utilisation']::text[], array['optimiser']::text[], array['debt_headroom']::text[], array['amber','red']::text[], array['general']::text[],
  'standard', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'lower-utilisation-headroom', 'why-available-headroom-matters', 1, 'published', null,
  'Why available headroom matters',
  'Using less of an existing revolving limit can leave more room for normal spending shocks and reduce reliance on further borrowing.',
  $body$## Headroom is practical, not cosmetic
Available credit is not spare income, but using less of your existing limit can reduce pressure and make your current position easier to manage.

## Improve without adding credit
Where affordable, paying down a balance can create headroom without opening another account. Do not borrow elsewhere simply to make an utilisation percentage look better.

The right pace depends on your budget and existing commitments.$body$,
  2, array['utilisation','headroom']::text[], array['adult']::text[], array['reduce-utilisation']::text[], array['optimiser']::text[], array['debt_headroom']::text[], array['amber']::text[], array['general']::text[],
  'standard', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'hard-vs-soft-searches', 'hard-searches-vs-soft-searches', 1, 'published', null,
  'Hard searches vs soft searches',
  'A soft search can help you explore eligibility without the same visible application footprint as a hard credit application.',
  $body$## Soft search
A soft search is commonly used for quotation or eligibility-style checks and is not the same as making a full credit application.

## Hard search
A full credit application commonly creates a hard-search footprint on your credit file. Repeated applications can therefore add visible application activity.

Always check the provider's wording before continuing so you know whether the next step is a soft check or a full application.$body$,
  2, array['applications','searches']::text[], array['adult']::text[], array['application-cooldown']::text[], array['optimiser']::text[], array['application_readiness']::text[], array['amber','green']::text[], array['general','application_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'application-spacing', 'application-spacing', 1, 'published', null,
  'Why spacing applications can help',
  'Several hard applications close together create repeated search footprints. Waiting can be more useful than making another unnecessary application.',
  $body$## Avoid application stacking
A hard application normally leaves a search footprint. Multiple searches close together can add visible application activity to your file.

## There is no universal countdown
Credit Quest does not invent a lender waiting rule. If recent applications are a current blocker, the safer action may be to stop, improve what you can control and reassess later.

Where available, a clearly identified soft eligibility check can be a lower-impact way to explore options.$body$,
  2, array['applications','searches']::text[], array['adult']::text[], array['application-cooldown']::text[], array['optimiser']::text[], array['application_readiness']::text[], array['amber','red']::text[], array['general','application_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'direct-debits-payment-safeguards', 'direct-debits-and-payment-safeguards', 1, 'published', null,
  'Use payment safeguards to avoid mistakes',
  'A direct debit or other reliable reminder can reduce the chance of an avoidable late payment, provided enough money is available when payment is due.',
  $body$## Automate the reminder, not the affordability
A direct debit can help make sure a required payment is not simply forgotten. You still need enough money in the paying account when it is collected.

## Choose the right safeguard
Review the payment amount and due date, keep contact details current and use alerts if they help. If you are struggling to pay, contact the provider rather than assuming automation will solve the shortfall.

Protecting an existing payment comes before taking new credit.$body$,
  2, array['payments','direct-debit']::text[], array['adult']::text[], array['set-up-direct-debit']::text[], array['credit_rebuilder']::text[], array['payment_health']::text[], array['red','amber']::text[], array['general','safe_mode_safe']::text[],
  'sensitive', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'missed-payment-prevention', 'reduce-the-chance-of-a-missed-payment', 1, 'published', null,
  'How to reduce the chance of a missed payment',
  'Knowing due dates, using reminders and asking for help early can reduce avoidable payment problems and protect financial stability.',
  $body$## Make the next payment visible
Keep a simple list of due dates and amounts. Use calendar reminders, balance alerts or direct debits where they suit your circumstances.

## Act before the due date if there is a problem
If you expect difficulty making a payment, contact the provider early and consider free debt guidance. Do not wait for a missed payment before seeking help.

Credit Quest Safe Mode prioritises this kind of stability work over new borrowing.$body$,
  2, array['payments','stability']::text[], array['adult']::text[], array['set-up-direct-debit']::text[], array['credit_rebuilder']::text[], array['payment_health']::text[], array['red','amber']::text[], array['general','safe_mode_safe']::text[],
  'sensitive', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'electoral-roll-basics', 'electoral-roll-basics', 1, 'published', null,
  'Why the electoral roll can matter',
  'Electoral-roll information can help organisations verify identity and address details. Register only if you are eligible to vote in the UK.',
  $body$## Identity and address matching
Correct electoral-roll information can support identity and address verification. It does not guarantee credit approval.

## Use the official route
If you are eligible to register, use the GOV.UK service and enter accurate current-address information.

Credit Quest treats this as an identity/setup action, not as a promise that your score or approval outcome will change.$body$,
  2, array['identity','electoral-roll']::text[], array['adult']::text[], array['register-electoral-roll']::text[], array[]::text[], array['identity']::text[], array[]::text[], array['general']::text[],
  'standard', 'GOV.UK / MoneyHelper', 'https://www.gov.uk/register-to-vote', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'credit-history-length', 'why-credit-history-takes-time', 1, 'published', null,
  'Why credit history takes time',
  'Credit history is built through observed behaviour over time. There is no safe shortcut that replaces consistent, affordable account management.',
  $body$## Time is part of the evidence
A newer or thinner file contains less history for a lender to assess. Consistent account management gradually adds more information.

## Avoid forcing history
Opening several accounts quickly can create extra applications without creating mature history overnight.

Focus on keeping existing commitments well managed and let useful history accumulate naturally.$body$,
  2, array['credit-history','thin-file']::text[], array['adult']::text[], array['build-revolving-history']::text[], array['thin_file']::text[], array[]::text[], array['amber']::text[], array['general']::text[],
  'standard', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'thin-file-basics', 'what-a-thin-credit-file-means', 1, 'published', null,
  'What a thin credit file means',
  'A thin credit file simply means there is limited credit-history information available. It does not automatically mean you have handled credit badly.',
  $body$## Limited evidence is different from bad evidence
Someone who is new to credit may have only a small amount of recorded history. A lender therefore has less past credit behaviour to assess.

## Build slowly
If an appropriate product step eventually makes sense, eligibility-first routes and modest, manageable use are preferable to making several applications at once.

Credit Quest will not infer thin-file details that your current data does not support.$body$,
  2, array['credit-history','thin-file']::text[], array['adult']::text[], array['build-revolving-history']::text[], array['thin_file']::text[], array[]::text[], array['amber']::text[], array['general']::text[],
  'standard', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'new-to-uk-credit-context', 'building-uk-credit-context-carefully', 1, 'published', null,
  'Building UK credit context carefully',
  'Moving to the UK can mean some local credit-history information is limited. Start with accurate identity, address and financial information rather than repeated applications.',
  $body$## Local information can be limited
A person who is new to the UK may not have much UK credit-file history. That is not the same as a poor payment record.

## Start with what is verifiable
Keep address and identity information accurate, use financial accounts responsibly and avoid assuming that overseas history will transfer in a particular way.

Credit Quest does not infer that someone is new to the UK from ordinary profile fields; this topic is shown only when that context is explicitly known.$body$,
  2, array['new-to-uk','credit-history']::text[], array['adult']::text[], array[]::text[], array['new_to_uk']::text[], array['identity']::text[], array['unknown','amber']::text[], array['general']::text[],
  'sensitive', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'decline-recovery', 'what-to-do-after-a-credit-decline', 1, 'published', null,
  'What to do after a credit decline',
  'A decline is a reason to stop and understand the situation, not to send the same application to several other lenders immediately.',
  $body$## Do not chase the decline
Another lender may make a different decision, but repeated applications can add more hard-search activity without fixing the reason your profile is currently weak.

## Recover methodically
Check your credit-file information, review affordability and recent applications, and correct any errors. Ask the lender for information about the decision where its process allows.

When you explore again, prefer a clearly identified soft eligibility route where appropriate.$body$,
  3, array['decline','applications']::text[], array['adult']::text[], array['application-cooldown']::text[], array['credit_rebuilder','optimiser']::text[], array['application_readiness']::text[], array['red','amber']::text[], array['general','application_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'waiting-can-be-right', 'why-waiting-can-be-the-right-move', 1, 'published', null,
  'Why waiting can be the right move',
  'Not applying can be a positive action. Waiting can prevent another unnecessary hard search while you stabilise payments or improve known blockers.',
  $body$## Progress is not always an application
If recent missed payments, repeated applications or other stability signals are present, another application can add activity without improving the underlying position.

## Use the time
Protect current payments, reduce avoidable pressure, correct inaccurate data and complete the next useful mission.

Credit Quest does not invent a universal waiting period. It reassesses from the evidence it actually has.$body$,
  2, array['waiting','applications','stability']::text[], array['adult']::text[], array['application-cooldown']::text[], array['credit_rebuilder','optimiser']::text[], array['application_readiness','payment_health']::text[], array['red','amber']::text[], array['general','safe_mode_safe']::text[],
  'sensitive', 'Credit Quest rules / MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'affordability-basics', 'affordability-is-more-than-a-credit-score', 1, 'published', null,
  'Affordability is more than a credit score',
  'A credit score does not show whether a new payment fits your real budget. Affordability looks at income, commitments and financial circumstances.',
  $body$## A separate question from credit history
A lender can consider whether repayments appear affordable as well as how previous credit has been managed.

## Credit Quest is cautious here
The current Credit Passport leaves Affordability & Stability unknown because the app does not yet have enough verified evidence for a responsible assessment.

Do not treat a strong-looking score as proof that more borrowing is affordable.$body$,
  2, array['affordability','budget']::text[], array['adult']::text[], array[]::text[], array['affordability_constrained']::text[], array['affordability_stability']::text[], array['unknown','amber','red']::text[], array['general']::text[],
  'regulated_adjacent', 'FCA / MoneyHelper', 'https://www.fca.org.uk/consumers/credit-loans-debt', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'correct-credit-file-errors', 'how-to-challenge-credit-file-errors', 1, 'published', null,
  'How to challenge incorrect credit-file data',
  'If information on your credit file is wrong, challenge the inaccurate record rather than trying to compensate by making new applications.',
  $body$## Accuracy matters
Credit-file information should reflect the underlying facts. Review the entry, gather evidence and use the credit reference agency or organisation's dispute process.

## Keep a record
Save copies of correspondence and note when the correction was requested. Different organisations may need time to investigate and update records.

Do not pay a company simply because it promises that accurate negative information can always be removed.$body$,
  3, array['credit-file','errors','disputes']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array['identity','payment_health']::text[], array[]::text[], array['general']::text[],
  'sensitive', 'ICO', 'https://ico.org.uk/for-the-public/credit/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'fraud-identity-protection', 'protect-your-identity-and-credit-file', 1, 'published', null,
  'Protect your identity and credit file',
  'Unexpected credit activity can be a fraud warning. Protect personal information and act quickly if you see accounts or searches you do not recognise.',
  $body$## Watch for unfamiliar activity
Unexpected accounts, searches or messages can indicate that personal information has been misused.

## Take protective action
Secure affected accounts, change compromised credentials, contact relevant providers and use authoritative fraud-reporting guidance where appropriate.

Do not share passwords, one-time codes or full card details with Credit Quest. The app never needs them for its guidance.$body$,
  3, array['fraud','identity']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array['identity']::text[], array[]::text[], array['general','safe_mode_safe']::text[],
  'sensitive', 'NCSC / Action Fraud', 'https://www.ncsc.gov.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'mortgage-preparation', 'credit-basics-before-a-mortgage-application', 1, 'published', null,
  'Credit basics before a mortgage application',
  'Mortgage preparation is broader than raising a credit score: check your file, budget, commitments and application timing before making a full application.',
  $body$## Prepare the whole picture
A mortgage lender can consider affordability, deposit, income, commitments and credit history. No single consumer score guarantees a mortgage decision.

## Before applying
Check credit-file accuracy, avoid unnecessary new borrowing and understand your budget. A broker or lender can explain product-specific requirements.

Credit Quest Academy provides general preparation only, not mortgage advice or lender-specific criteria.$body$,
  3, array['mortgage','preparation']::text[], array['adult']::text[], array[]::text[], array['optimiser']::text[], array['application_readiness','affordability_stability']::text[], array['green','amber']::text[], array['general','application_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'car-finance-preparation', 'credit-basics-before-car-finance', 1, 'published', null,
  'Credit basics before car finance',
  'Before car finance, look beyond the headline monthly payment: consider total affordability, your existing commitments and whether a hard application is necessary.',
  $body$## Start with affordability
A lower monthly payment can still come with a longer commitment or higher total cost. Understand the agreement before applying.

## Protect your application footprint
Compare information and use quotation or soft-search routes where they are clearly offered before making an unnecessary full application.

Credit Quest does not provide a lender acceptance threshold or predict the finance decision.$body$,
  3, array['car-finance','preparation']::text[], array['adult']::text[], array[]::text[], array['optimiser']::text[], array['application_readiness','affordability_stability']::text[], array['green','amber']::text[], array['general','application_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper / FCA', 'https://www.fca.org.uk/consumers/credit-loans-debt', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'revolving-credit-basics', 'what-revolving-credit-is', 1, 'published', null,
  'What revolving credit is',
  'Revolving credit lets you borrow, repay and reuse an agreed limit, as with many credit cards. It should be managed as borrowing, not extra income.',
  $body$## How it works
A revolving account has a credit limit and a balance that can change as you spend and repay. Interest and fees depend on the product and how it is used.

## Build history carefully
For someone with a thin file, a suitable low-limit account may eventually create useful payment history, but only if it is affordable and managed responsibly.

Do not open revolving credit solely to chase a score.$body$,
  2, array['revolving-credit','credit-cards']::text[], array['adult']::text[], array['build-revolving-history']::text[], array['thin_file']::text[], array['debt_headroom']::text[], array['amber']::text[], array['general','borrowing_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'credit-limits-headroom', 'credit-limits-and-available-headroom', 1, 'published', null,
  'Credit limits and available headroom',
  'A credit limit is the maximum agreed borrowing on an account. The unused part is headroom, but it is not money you have earned or saved.',
  $body$## Know the two numbers
Your balance shows what is being used. Your limit shows the agreed maximum. The difference is available credit.

## Headroom can reduce pressure
Using less of a limit may leave more flexibility, but increasing a limit or opening another account is not automatically the right solution.

Credit Quest prefers improving balances where practical over borrowing simply to alter a ratio.$body$,
  2, array['limits','headroom','utilisation']::text[], array['adult']::text[], array['reduce-utilisation']::text[], array['optimiser']::text[], array['debt_headroom']::text[], array['amber']::text[], array['general']::text[],
  'standard', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'eligibility-soft-searches', 'eligibility-checks-and-soft-searches', 1, 'published', null,
  'Why soft eligibility checks can be useful',
  'When a provider clearly offers a soft eligibility check, it can help you explore suitability without immediately making a full hard-search application.',
  $body$## Check the type of search
Eligibility tools can differ. Read the provider's explanation so you know whether the check is soft and whether continuing further would become a full application.

## Eligibility is not approval
A positive eligibility result is not a guarantee that a later application will be accepted. A lender can perform additional checks before making a decision.

Credit Quest only points toward eligibility-first routes after its own safety and readiness gates allow it.$body$,
  2, array['eligibility','soft-search']::text[], array['adult']::text[], array['build-revolving-history']::text[], array['thin_file','optimiser']::text[], array['application_readiness']::text[], array['green','amber']::text[], array['general','application_oriented']::text[],
  'regulated_adjacent', 'MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
),
(
  'credit-quest-readiness', 'what-credit-quest-readiness-means', 1, 'published', null,
  'What Credit Quest Application Readiness means',
  'Application Readiness is Credit Quest guidance about blockers it currently checks. Green means those blockers are absent, not that a lender will approve you.',
  $body$## Four states
Credit Quest can show red, amber, green or unknown. The state is derived from the evidence the app currently has and from protective rules such as Safe Mode and age gating.

## Green is deliberately limited
Green means the specific blockers Credit Quest checks are not present in the available data. It is not an underwriting result, approval probability or lender score.

Unknown is valid when evidence is missing, and red can correctly mean do not apply yet.$body$,
  2, array['credit-quest','readiness']::text[], array['adult']::text[], array[]::text[], array[]::text[], array['application_readiness']::text[], array['red','amber','green','unknown']::text[], array['general']::text[],
  'standard', 'Credit Quest product rules', null, 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'credit-passport-explained', 'what-your-credit-passport-shows', 1, 'published', null,
  'What your Credit Passport shows',
  'The Credit Passport organises Credit Quest evidence into five guidance pillars. It is not a credit-reference-agency score or a lender underwriting result.',
  $body$## Five guidance pillars
The Passport shows Identity & Traceability, Payment Health, Debt & Headroom, Affordability & Stability and Application Readiness.

## Statuses explain evidence
Green, amber, red and unknown help organise what Credit Quest currently knows. Unknown is kept when evidence is insufficient rather than filling gaps with guesses.

The Passport should help explain what to work on next, not encourage unnecessary applications.$body$,
  2, array['credit-quest','passport']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array['identity','payment_health','debt_headroom','affordability_stability','application_readiness']::text[], array[]::text[], array['general']::text[],
  'standard', 'Credit Quest product rules', null, 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'quest-score-explained', 'what-the-quest-score-does-and-does-not-mean', 1, 'published', null,
  'What the Quest Score does — and does not — mean',
  'The Quest Score is an internal progress indicator for Credit Quest missions. It is not a bureau score and does not predict lender approval.',
  $body$## A progress tool
The Quest Score helps make progress visible as you complete useful actions in the Credit Quest journey.

## Not a lending score
It is not an Experian, Equifax or TransUnion score, and it is not used to turn a user into green Application Readiness.

The more important question is whether your next action is sensible for your current evidence and safety state.$body$,
  2, array['credit-quest','quest-score']::text[], array['general','adult']::text[], array[]::text[], array[]::text[], array[]::text[], array[]::text[], array['general']::text[],
  'standard', 'Credit Quest product rules', null, 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'credit-basics-under-18', 'credit-basics-before-18', 1, 'published', null,
  'Credit basics before 18',
  'You do not need to borrow to prepare for adult credit. Learning how files, payments, searches and fraud protection work is useful preparation on its own.',
  $body$## Learn first
Before 18, Credit Quest keeps the experience educational. It does not recommend adult credit products or encourage an application.

## Useful things to understand
- What a credit file contains.
- Why accurate identity information matters.
- Why paying bills and commitments on time matters.
- The difference between hard and soft searches.
- How to protect personal information from fraud.

There is no need to borrow simply to chase a future credit score.$body$,
  2, array['basics','under-18']::text[], array['under18']::text[], array[]::text[], array[]::text[], array[]::text[], array['unknown']::text[], array['under18_safe']::text[],
  'standard', 'Credit Quest education rules / MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', null, '2026-08-28T00:00:00Z'
),
(
  'protect-payments-first', 'protect-payments-first', 1, 'published', null,
  'Protect payments first',
  'When finances are under pressure, stabilising existing commitments is more important than testing the situation with another credit application.',
  $body$## Stability comes first
Credit Quest Safe Mode pauses product suggestions when protective signals say the priority should be existing payments and financial stability.

## Practical priorities
- Know what is due and when.
- Use reminders or payment safeguards where appropriate.
- Contact providers early if you expect difficulty paying.
- Seek free debt guidance if you need broader support.
- Avoid an unnecessary new application while stability signals remain.

Safe Mode is designed to reduce pressure, not to punish a low score.$body$,
  2, array['payments','safe-mode','stability']::text[], array['adult']::text[], array[]::text[], array['credit_rebuilder']::text[], array['payment_health','application_readiness']::text[], array['red']::text[], array['safe_mode_safe']::text[],
  'sensitive', 'Credit Quest Safe Mode rules / MoneyHelper', 'https://www.moneyhelper.org.uk/', 'Credit Quest Editorial', '2026-08-28T00:00:00Z', '2027-02-28T00:00:00Z', '2026-08-28T00:00:00Z'
);
