# Referral program announcement email (founder send)

**Status:** Draft for founder review. Do not send until the referral surfaces (dashboard card, settings tab, earned-credit email) are deployed.

## Why this format

At the current user count (~120 signups), a short plain-text note from the founder's personal address will outperform a designed marketing blast. It reads like a person telling you something useful, it lands in Primary instead of Promotions, and replies come straight back to you (replies are a bonus: every reply is a conversation with a user).

## Send mechanics

- **From:** your personal address (the one you use for founder activation messages), not noreply@.
- **To:** all signups who have not unsubscribed from product email. Exclude bounced addresses.
- **Personalization:** each user's real referral link is `https://www.utilitysheet.com/auth/signup?ref=<their-slug>`. Their slug is their intake link slug (`intake_links.slug`). If your send tool can't merge per-user links, fall back to "find your link under Settings > Referrals" and drop the link line.
- **Batching:** with ~120 recipients, Resend broadcasts or small BCC batches both work. Keep it plain text either way.
- **Timing:** a weekday mid-morning. Avoid Monday morning inbox pileup.

## Subject line

Pick one, no need to A/B at this volume:

1. `Give a month of Pro, get a month of Pro` (recommended: says the whole offer)
2. `A free month of Pro for you and a TC you know`
3. `New in UtilitySheet: referral credits`

## Body (plain text)

```
Hi {{first_name}},

Quick update from me. UtilitySheet now has a referral program, and it's simple:

Give a month of Pro, get a month of Pro.

Share your personal referral link with another TC or agent. When they sign up and receive their first real seller submission, you get a free month of Pro ($9 credit, applied to your bill automatically) and they get a free Pro month too.

Your referral link:
{{referral_link}}

You can also find it anytime under Settings > Referrals, along with a running count of the months you've earned.

If there's one person you'd send it to, it's probably the TC or agent on the other side of your last closing. They've already seen the finished sheet.

That's it. If you have questions or ideas, just reply, I read everything.

Thanks for using UtilitySheet,
Haydn
```

## Notes on the copy

- The one-sentence offer is the subject and the third line. Everybody who reads three lines understands the program.
- "The TC or agent on the other side of your last closing" gives them a concrete person to think of, which is the difference between "nice" and "forwarded".
- The reply invitation is deliberate. At this stage every reply is worth more than the referral itself.
- Keep it under 150 words if you edit. Resist adding screenshots or feature lists.

## After sending

- Watch `referral_credit_card_viewed` and `referral_credit_link_copied` events, plus signups attributed with a `ref` code, over the following 7 days.
- Log the send date and results in [experiment-log.md](experiment-log.md) so the referral channel gets a baseline like every other channel.
