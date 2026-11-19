# Product Reviews (thought experiment)

Two imagined reviews of Kalkul 18 months out — the same product and the same
features, with opposite outcomes. They are a pre-mortem/pre-mortem-in-reverse:
the one-star is what happens if tracking stays a chore, the projection
over-promises, and cloud loses data; the five-star is the same features with the
trust kept. The gap between them is, effectively, the product spec.

See `strategy-assumptions.md`, `tracking-improvements.md`, and
`planning-reward-features.md` for the underlying strategy these reviews stress-test.

---

## ★☆☆☆☆ — "Trusted it with my whole financial life. Big mistake."

I almost never write reviews but I'm angry enough to make an exception.

I found this last year, loved the pitch — free, open-source, "your data stays
yours," finally a planning tool that isn't trying to sell my info to a bank. I got
invested. Genuinely. I spent _months_ entering everything by hand — every account,
my IBKR balance, the pension, the mortgage, my wife's income — because the whole
promise was that this becomes your "single source of truth." So I did the work.
Every single month, re-typing numbers into little boxes like it's 2009. In [current
year]. A tool that wants to be my financial home base and it can't even pull a
balance automatically — you just… retype it, forever, and if you skip a month the
whole picture is quietly wrong and you don't even notice.

Then I upgraded to the paid cloud plan, specifically so I wouldn't have to worry
about all this living in a browser. Fine, take my money.

Here's where I actually feel cheated. Two things.

One: I made a real decision on the back of this. The projection looked great — a
beautiful confident line going up and to the right — so we told ourselves we could
take the leap. Turns out that gorgeous chart is just _assumptions_ wearing a suit.
When reality came in under it, there was no warning, no "hey, you're tracking
behind," nothing. Just a pretty graph that made me feel certain about something I
had no business being certain about.

Two, and this is the one that made me cancel: I got a new laptop. Went to log in.
**My data was gone.** Months of it. I contacted support and got a polite lecture
about how it's "local-first" and I "should have been exporting backups regularly."
I was PAYING YOU FOR CLOUD. What exactly was I paying for? The restore either never
had my data or silently didn't work, and now it's vaporized. You know what's very
"privacy-respecting"? Data so private that even _I_ can't get it back.

So: I did all the manual labor you asked, I paid you, I made life choices trusting
your numbers, and I walked away with stale figures, a decision I regret, and
nothing to show for it. All wrapped in this smug open-source halo about how you're
the good guys who respect me.

You didn't respect my time, my money, or my trust. Refund requested. Avoid.

---

## ★★★★★ — "The first money app I've actually kept using for more than a month."

I've started and abandoned every budgeting and planning tool you can name.
Spreadsheets I stopped updating by February. US retirement tools that assume I have
a 401(k) and don't understand my pension, my mortgage, or my currency. Bank apps
that are really just ads for the bank's own funds. So I went in expecting to churn
out of this one too.

I didn't. It's been almost a year and I still open it once a month, and I want to
explain _why_, because it's not obvious.

The update takes me about two minutes. One screen, I punch in the handful of
balances that actually moved — cash, the IBKR account, not the stuff that doesn't
change — and I'm done. No linking my bank to some third party I've never heard of,
no "connect your accounts" dark pattern. And here's the thing that got me hooked:
the moment I hit save, it doesn't just say "saved." It tells me what changed _about
my life_. "Financial independence: 64% (up from 61%)." "Your money now lasts about
two years longer than last quarter." I did not expect a spreadsheet chore to feel
like progress, but it does. That little number going up is genuinely why I come back.

The projections are honest, which I didn't appreciate until later. It shows a
range, not one confident fairy-tale line, and it actually told me when I was
drifting behind my own plan instead of letting me find out the hard way. When we
were deciding whether we could afford a longer parental leave, I ran the scenario,
saw the realistic downside, and made the call with my eyes open. It didn't tell me
what I wanted to hear. It told me what was true. That's rare.

At some point it also nudged me that my investments had actually been growing
faster than the plan assumed and asked if I wanted to update the assumption. Small
thing. But it meant the plan was quietly getting _more_ accurate the longer I used
it, instead of drifting into fantasy.

And the stuff that matters underneath: my data is mine. It's private, the maths is
open for anyone to check, and when I got a new phone it was all just… there. I've
got my exports too, because they made that easy. I trust it, and I don't say that
about anything financial.

It's not for people who want their bank auto-synced and zero effort — you do have
to type your numbers. But if you're willing to spend two minutes a month, it's the
only tool that's made me feel like I actually understand where I'm going. Bought
the subscription happily. Told my brother. Worth it.

---

## What the gap tells us to protect

Each item is a promise that, if kept, turns the one-star into the five-star. They
are the same features; only the friction, honesty, and safety net differ.

- **Make manual entry genuinely fast, and only ask for what moved.** The two-minute
  monthly ritual is the retention engine. The moment it feels like the spreadsheet
  again, they're gone. (See `tracking-improvements.md`.)
- **End every update in a "your life moved" moment, not "saved."** FI %/runway
  ticking up is what converts a chore into a habit — the most-cited reason the
  five-star user stayed. (See `planning-reward-features.md`.)
- **Be honest in the projection: ranges, behind-plan warnings, "these are
  assumptions."** The one-star felt lied to by a confident line; the five-star
  trusts it _because_ it didn't flatter them. Honesty is the feature, not a
  disclaimer — and the liability shield.
- **Never lose their data, and make that visible.** Seamless restore on a new
  device and easy exports turn local-first from a liability into a point of pride.
  For a paying "cloud" user, restore must be bulletproof and _proven_ to them.
  Get this wrong once and it's an instant one-star (and a trust-grade risk).
- **Mean the privacy/open-source promise.** Delivered sincerely, it's why they
  trust you with the scariest data they have — and why they tell their brother.
  The same virtue that wins them makes betrayal feel like hypocrisy; the trust
  ceiling is higher, so the fall is harder.
- **Fit their world (EU pensions, currency, tax reality).** "US tools don't
  understand my life" is the wedge; being the one that does is why they chose you
  over incumbents.
