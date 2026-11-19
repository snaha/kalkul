# Product page: feedback and a proposed direction

Working notes on the product page design in Figma (`Kalkul_v4`, node 864-8976). A clickable proposal lives at https://claude.ai/code/artifact/13be7108-2b9a-4079-994f-277b52987c58.

## What holds the current design back

- **The page never shows the product.** A finance planner's most persuasive asset is its own chart. The design shows a stock illustration instead, so the visitor has to take the copy's word for what they get.
- **The illustration and the header send the wrong signals.** The Streamline clip-art figure meditating on a rug says "wellness app", and it reads as generic because it is a stock asset. The washed-out candlestick background says "stock trading", which is the opposite of long-term planning. With the gray gradient on white, the hero looks unfinished rather than calm.
- **Nothing has hierarchy.** The headline, the three features and the privacy line all sit at a similar weight and are all centered. There is no single element the eye lands on, so nothing feels important.
- **The copy describes features, not outcomes.** "Achieve financial peace" is a wellness claim any app could make. The subhead is one 30-word sentence. The feature blurbs use terms like runway and independence score before the reader knows what they mean, and each one is written from the software's point of view.
- **The strongest differentiator is in the weakest spot.** No account, no cloud and open source is a real reason to choose Kalkul, and on the page it is a gray alert bar most readers will skip.
- **Nothing is concrete.** No numbers, no example person, no "who this is for". A dry topic gets interesting through specifics, and the page has none.

## What the proposal changes

- **The hero is the projection chart**, drawn from example data in the app's own colors. Recorded years are solid, projected years are faded, and a "Today" line separates them. That one object explains tracking, projecting and the decades-ahead promise without a paragraph of text.
- **The copy leads with the outcome.** Headline: "Know where your money leads." The hint under the buttons answers the two questions a first visitor has: no account needed, and about ten minutes to a first projection.
- **A plans section makes the idea concrete**: keep renting versus buy a flat in 2028, side by side, with the numbers that differ and the year cash runs low. This is the feature nobody else has, and the current design gives it three lines of text.
- **Privacy is a section, not a footnote.** The advisor idea is shown as planned, not as a feature.
- **Typography carries the page** instead of an illustration: Reddit Sans throughout, Reddit Mono for numbers, the app's own logo. No stock art anywhere.
- Light and dark themes both work, and the chart has a hover tooltip.
- No section labels above the headings; the headings carry the sections on their own.

## Example data

The example person is Claire, 40, in Lyon. All figures are in euros. The hero chart runs from 2018 to 2060: a flat bought in 2021 with a mortgage, investments compounding, the loan paid down, savings drawn down from 2048. The plan comparison uses a €260k flat with 20% down, bought in 2028.

## Open decisions

- **The app's cash color on a white page.** Kalkul's sky blue fails a contrast check on white. The proposal keeps it for fidelity and relies on the legend and tooltip, but the dashboard has the same problem, so it may be worth a product-level tweak.
- **Which sections survive.** The proposal has six: hero, what Kalkul does, plans, privacy, planned advisor, closing call to action. If that is too long for a launch page, the plans section is the one to keep and the advisor note is the one to drop.

## Copy, section by section

**Hero**

- Headline: Know where your money leads.
- Lede: Enter what you own, what you owe, and what comes in and goes out each month. Kalkul projects your net worth year by year for the decades ahead, and you can try out big decisions on a copy before making them for real.
- Buttons: Start planning / Try the demo
- Hint: No account needed. The first projection takes about ten minutes.

**What Kalkul does**

- Heading: Write your finances down once, keep them current, and see where they lead.
- Intro: Kalkul is not a budgeting app or a brokerage. It is where your whole financial situation is written down, kept up to date, and projected into the future.
- Start with what you have: Cash, investments, property, loans, income and expenses. When something changes, update it. Between updates Kalkul carries the balances forward and tells you when they are out of date.
- See decades ahead: As soon as your numbers are in you get a projection as far ahead as you want: net worth by year, how many years your savings would last, and how far you are from being able to live off them.
- Try out decisions: Buy the flat in 2028 or keep renting? Take a year off? Retire at 55? Each plan is a copy of your real finances that you can change and compare with the others.

**Plans**

- Heading: Compare two futures side by side.
- Intro: Every plan starts from your real numbers, so you are comparing outcomes you could actually reach.
- Note: Example figures. Kalkul marks the years a plan cannot pay for, like the low cash in 2029 here.

**Privacy**

- Heading: Your data stays on your device.
- Intro: Most finance apps want your bank login before they show you anything. Kalkul has no account and no server, so there is nothing to hand over and nothing that can leak.
- Stored in your browser: Everything you enter is saved on this device. It is still there when you come back, and it was never sent anywhere.
- Backups are a single file: Export your data whenever you want, move it to another computer, or keep it with your other records.
- Open source: The projection code is public, so you can check how any number was calculated, or improve it.

**Planned**

- Advice when you want it. Take your projection to a human advisor so they work from your real figures, or ask an AI advisor that sees the same chart you do. In both cases the numbers are yours and the advice is a second opinion.

**Closing**

- Heading: Your first projection takes about ten minutes.
- Text: Start with rough numbers and refine them later. The chart updates as you go.
