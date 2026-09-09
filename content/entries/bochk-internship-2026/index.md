---
# Rewritten 29 Jul 2026, four weeks into a two-month placement. The previous body
# was written before the internship began and still said "The plan is…", with
# What I learned and How it felt empty on the live page.
# Written from what Derek reported doing, and deliberately generic by his
# instruction: no subdivision names, no systems, no control detail, no figures,
# nothing client-related, and none of the agent workflow's design — only that the
# brief existed and what he took from it.
#
# 1 Sep 2026 — the placement has ended, and Derek supplied his study notes on the
# department's own strategy briefing. **Most of that document is not on this page,
# on purpose.** Its source deck is marked 【Confidential】 and forensically
# watermarked, and the notes' own handling section says to keep the specifics off
# third-party services, adding that a reference or return offer may depend on this
# team. So what was taken from it is only what survives the standing instruction
# above: the *shape* of two lessons, and three task-level facts about his own work
# that were missing. Withheld deliberately, and listed here so nobody has to
# re-derive the judgement — the department's scale and volume figures, its cost and
# productivity percentages, the org chart and unit names, the transformation
# programme's stages and branding, the platform and control-tool acronyms, the
# forward migration plans, the site-by-site division of labour, and every named
# individual. None of that is his to publish, and none of it makes the entry better.
#
# Closed 1 Sep 2026. Derek then supplied his own end-of-placement reflection, which
# is where the second half of What I learned and the whole of How it felt now come
# from. It arrived written in the second person — "you learnt", "you spent" — and is
# rendered here in his own voice, which is a translation and not an embellishment:
# nothing is claimed that the draft did not say.
#
# It also arrived carrying the figures withheld above — the process count, the
# monthly volume, the three sites and nine offices, the productivity percentage, and
# the internal name for per-step timing. Those are stripped again rather than
# reinstated, because supplying a reflection is not the same as authorising a
# disclosure, and every one of those lessons survives without its number. The one
# figure kept is the count of workflows he mapped himself: that is his own work
# product rather than the bank's data, and his notes' own advice is that a vague
# contribution claim does not survive an interview follow-up.
title: "Bank of China (Hong Kong) — Summer Internship"
category: "experience"
date: 2026-07-01
endDate: 2026-08-31
updated: 2026-09-01
role: "Summer Intern — Bank-Wide Operation Department, Loans Division"
organization: "Bank of China (Hong Kong)"
location: "Hong Kong"
summary: "Two months inside the operations side of a major bank — loan documentation, reconciliation and reporting — and, unexpectedly, a brief to survey where AI could help across the department and draft an agent workflow for it. The survey turned out to be a departmental deliverable rather than an intern exercise."
note: "They gave the newest person in the department the job of finding where the work is still done by hand."
cover: "./images/cover.svg"
gallery: []
tags: ["banking", "operations", "loans", "ai-workflow"]
links: []
featured: false
draft: false
---

## What it was

A summer internship at **Bank of China (Hong Kong)** in the **Bank-Wide Operation
Department, Loans Division** — the operational function underneath the bank's lending
business, where applications become cases and cases become money moving.

The word that matters in the department's name is *bank-wide*. This is not a branch
back-office; it is a **centralised processing function** that the rest of the bank
sends its work to. My division's part of that is credit *execution* rather than credit
*decision*: somebody else approves a facility, and the division turns the approval
into documents that are legally sound, security that is properly taken, and money that
actually moves. Document-heavy, deadline-bound, and with very little room to be wrong.

July to the end of August. **The sections below were written four weeks in**, and I
have left them in the present tense they were written in, because a report from the
middle is a different thing from a verdict at the end and I would rather not
retro-fit one into the other.

## What I did

The baseline is operations work, and I'd rather describe it plainly than dress it up.
Checking loan documentation for completeness and consistency before a case moves
forward. Data entry, and reconciling records so that what sits in one place matches
what sits in another. Preparing reports and summaries for the team. It is careful,
repetitive work where the whole value is in not being wrong.

Alongside that I've spent a lot of time shadowing — watching how a case actually
travels between people. That was deliberate. A fortnight before this started, an
adviser told me to use the internship to observe how the bank operates rather than
only completing the duties I'd been handed, and it's the single most useful thing
anyone has told me this year. It turns dead time into the good part.

Then the thing I did not expect. I was asked to **review where AI could help across
the department's other subdivisions, and to draft a working flow for an AI agent**.
So a large part of my four weeks has been going to teams that aren't mine, asking
what they do, how they do it, what part of it they'd hand to a machine tomorrow if
they could — and then trying to turn that into something structured enough to be
worth reading.

I won't put the findings or the design on a public page. But I can say that the
assignment and the shadowing turned out to be the same activity. You cannot say
where an agent would help until you understand who does what, in what order, and
what happens when it goes wrong.

Two smaller things filled the rest of it, and they belong here because they are most
of what an operations internship actually consists of: **user-acceptance testing** for
system changes — sitting with a build before it goes live and trying to break it
against the way the work really runs — and drafting **internal communications in
Traditional Chinese**, which is harder than it sounds when the audience is a
department that reads carefully for a living.

*Added 1 September, after the placement ended.* Two corrections to the account above,
both of which I only understood properly at the end. The survey **was not an intern
side-project**: collecting AI use cases was work the department had already committed
to doing that year, and I was contributing to something that existed rather than
inventing an exercise for myself. And the proposal that came out of my own division's
workflows was specifically about **document verification** — checking that what is on
a page is complete, consistent and the thing it claims to be — which is the natural
next step for a function that had already been reading documents by machine for years
and is, by some distance, the place where the manual volume sits.

## What I learned

*The first three were written four weeks in; the rest on 1 September, after it
ended.*

**How much is still done by hand.** This is the thing I'd tell a friend first. My
assumption walking in was that a bank this size would be more automated than it is,
and the reality is that an enormous amount still runs on people checking, re-keying,
emailing and confirming. I've stopped reading that as backwardness. Some of it is
regulatory, some is that the edge cases defeat the tooling, and some is genuinely just
that nobody has got to it. Working out which is which is most of the job I was given.

**And scale is what makes that matter.** The other thing that hit me was pace and
volume. A manual step that takes ninety seconds is nothing once and enormous across a
day's cases. That's why "still manual" is the interesting finding rather than a
complaint — the size of the operation is what converts a small inefficiency into a
real number. The two things I noticed most turn out to be one observation seen from
two angles.

**Scoping AI is not really an AI problem.** It's an operations-comprehension problem.
The hard part of my assignment has had nothing to do with models; it's been getting
an accurate picture of how work actually moves, as opposed to how the process
document says it moves. That's the same instinct as the rest of what I build — the
competition entry where every persona trait cites the post it came from, the pipeline
that refuses a claim it can't source. Ground it first, then automate. I've just never
had to do it inside an institution before.

---

*The rest are from the end.*

**The back office is where the cost and the risk actually live.** A finance degree
teaches the front — pricing, markets, valuation — and I arrived thinking that was
where the interesting problems were. Two months at the other end of the building
rearranged that. Processing is not the plumbing beneath the real work; it *is* a
large part of where an institution's money goes and where its mistakes happen, and
every step of it has a measured time and a measured risk attached. That is not
obvious from the outside, and I do not think I would have believed it if someone had
told me rather than shown me.

**Where AI actually gets applied, as opposed to where it gets talked about.** I spent
the summer at the unglamorous end: document verification in a loans division. Not a
chatbot, not a trading model, nothing anyone would put in a launch video. High volume,
structured inputs, expensive mistakes — that is the shape where automation genuinely
pays, and it is a shape I can now recognise somewhere else when I see it. Most of the
attention goes to the other kind, which is roughly the opposite of where the value is.

**A proposal has to be priced in the department's own currency, and it is not
novelty.** I arrived assuming the way to argue for automation was to show that it was
clever. It is not. The two questions that decide whether anything moves are **what it
does to the time a step takes** and **what it does to the risk of getting that step
wrong** — and a function like this one has real instruments for measuring both, which
means the questions are not rhetorical. "This is innovative" is not an answer to
either of them, and I watched myself have to translate my own idea into those two
terms before it could be discussed at all. That translation is the skill. It also
generalises well past banking: every operating function I am likely to work in will
have its own two currencies, and the first job is to find out what they are rather
than assuming mine transfer.

**That I can do professional work in Traditional Chinese.** Not conversational
fluency — drafting internal communications for a formal Chinese-corporate setting,
for readers whose job is reading carefully. I had no proof of that before and I do
now, and it is the kind of thing that is very hard to claim on a CV without having
done it.

**And where my own contribution stops.** I mapped about seventeen workflows and wrote
a proposal. I did not build it. I may never find out whether it was taken up. That
was uncomfortable at first and I have come round to thinking it is simply what
contributing to an institution looks like — your part is a part, it gets handed on,
and the thing you would most like to know is not yours to know.

**The part I did not expect to be the interesting one.** My standing question about
automation in financial services is not whether it works — it plainly does — but what
happens to the people whose work it changes. I went in braced to watch that go badly.
What I actually saw was an institution putting real weight behind training,
multi-skilling and formal professional qualification for the same staff whose
processes were being automated: the answer to "the machine now does the step you used
to do" was, structurally, "so you should be qualified to do the harder thing". I am
not naive enough to call that settled, and two months is not long enough to see where
it lands. But whether it is *sufficient* is now a question I am qualified to have an
opinion about, and I was not in June.

## How it felt

The first impression was scale, and it's still the impression. There's a particular
feeling in watching volume move through a room and realising that the abstractions I
learn in a lecture theatre are, down here, a queue of specific things that specific
people have to get right today.

The odd part is the assignment. I'm the newest person in the department and I've been
asked where the work could be done better — which is either a good idea or a strange
one, and I think it's genuinely both. New enough to see the manual steps as strange
rather than normal, and far too new to know which of them are load-bearing. I've tried
to hold both of those at once and ask more questions than I answer.

*Four weeks left*, I wrote. Then it ended — 31 August — and here is the rest of it.

**Real, and I was slightly surprised by that.** The survey I was handed was not
busywork invented to keep an intern occupied; it was something the department had
already decided it needed that year, and I was doing a piece of it. There is a
particular feeling in working that out, and it is not pride exactly. It is more like
the floor being further down than you had assumed.

**Small.** The volume that moves through that operation in a month is not a number a
person can stand next to. One summer against it is a rounding error, and depending on
the day that reads as humbling or as slightly deflating. I have decided it is mostly
the first. The work still has to be done by somebody, and being one of the somebodies
for two months is how anyone starts.

**Unfinished.** I handed over a proposal and walked out. No launch, no result, no
closure — the internship ended mid-sentence, which I gather is how most of them end.
The anticlimax is real even when the work was good, and I would rather write that down
than pretend the last day had a shape it did not have.

**And the one worth sitting with.** What I say I care about is whether the people
affected by financial automation get brought along. What I actually did all summer was
document where human work in a loans division could be handed to a model. That is not
hypocrisy — somebody has to do the mapping, and doing it carelessly is worse than
doing it carefully — but it is a tension, and I did feel some discomfort about which
side of it I was standing on. That discomfort is the most useful thing I brought home.
It is also the honest answer if anyone asks me what I found difficult, and I would
rather give that answer than a smoother one.
