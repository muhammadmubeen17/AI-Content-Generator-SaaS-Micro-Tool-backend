const { LENGTH_TOKENS } = require('../config/constants')

// Lazy-load Gemini client to avoid crash when API key is not set
let geminiClient = null

const getGemini = () => {
  if (
    !geminiClient &&
    process.env.GEMINI_API_KEY &&
    !process.env.GEMINI_API_KEY.startsWith('your-')
  ) {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    geminiClient = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
      },
    })
  }
  return geminiClient
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const buildPrompt = ({ contentType, tone, length, prompt }) => {
  const wordTargets = { short: 150, medium: 400, long: 800 }
  const words = wordTargets[length] || 400

  const typeInstructions = {
    blog: `Write a complete blog post with an engaging introduction, 2-3 body sections with subheadings, and a conclusion.`,
    ad_copy: `Write compelling ad copy with a strong hook, value proposition, key benefits (bullet points), and a clear call-to-action.`,
    proposal: `Write a professional business proposal with an executive summary, problem statement, proposed solution, timeline, and next steps.`,
    email: `Write a professional email with a subject line suggestion, greeting, concise body, and professional closing.`,
    social: `Write an engaging social media post with relevant emojis and hashtags at the end.`,
    product: `Write a compelling product description with a headline, key features as bullet points, benefits, and a call-to-action.`,
    youtube: `Write a YouTube content optimization package with these exact sections:
1. TITLE OPTIONS: 5 SEO-optimized, click-worthy title variations (use numbers, power words, curiosity gaps)
2. DESCRIPTION: Full video description (300-400 words) with an intro hook, timestamps placeholder section, links placeholder, and a subscribe CTA
3. TAGS: 15-20 comma-separated SEO-relevant tags`,
    upwork: `Write a compelling Upwork proposal that stands out. Include these sections:
1. OPENING HOOK: Personalized first paragraph showing you read and understood the job post
2. SOLUTION APPROACH: 3-4 step methodology for tackling the project
3. RELEVANT EXPERIENCE: Specific skills, metrics, and results from similar work
4. CALL TO ACTION: Confident, clear next step
Keep it under 280 words. Be specific and confident, not generic.`,
    fiverr_gig: `Write a complete, optimized Fiverr gig listing with these exact sections:
1. GIG TITLE (max 80 characters, starts with "I will", SEO-optimized)
2. GIG DESCRIPTION (800-1000 characters, benefit-focused, uses buyer language)
3. PACKAGES:
   BASIC - entry-level, lower price, shorter delivery (list 4 inclusions)
   STANDARD - most popular, moderate price (list 5 inclusions, mark as "Most Popular")
   PREMIUM - everything included, highest price (list 6 inclusions)
   For each: name, suggested price ($), delivery days, inclusions as bullet points
4. TAGS: 5 relevant comma-separated tags (single or two-word phrases)
5. FAQ: 3 common buyer questions with short, reassuring answers`,
    linkedin: `Write a high-performing LinkedIn post optimized for engagement. Structure:
1. HOOK: First 1-2 lines must stop the scroll (use bold claims, surprising stats, or direct questions — no "I'm excited to share")
2. BODY: Value-packed content with short paragraphs (1-3 lines max), line breaks between paragraphs, use → or numbers for lists
3. CTA: Specific question inviting comments or a share prompt
4. HASHTAGS: 4-5 relevant hashtags on the last line
Keep total length 150-280 words. Conversational, not corporate.`,
  }

  const instruction = typeInstructions[contentType] || typeInstructions.blog

  return `You are ContentAI, an expert content writer who creates high-quality, engaging, and conversion-focused content that is ready to publish.

Task: ${instruction}

Requirements:
- Tone: ${tone}
- Target length: approximately ${words} words
- Topic/Details: ${prompt}

Write the content now (output the content only, no preamble or meta-commentary):`
}

// ─── Mock responses (fallback when no API key) ────────────────────────────────

const MOCK_OUTPUTS = {
  blog: (prompt) => `# The Complete Guide: ${prompt.slice(0, 50)}

## Introduction

In today's rapidly evolving landscape, understanding ${prompt.slice(0, 30)} has never been more critical for businesses and individuals alike. This comprehensive guide breaks down everything you need to know to stay ahead of the curve.

## Why This Matters

The importance of this topic cannot be overstated. Research shows that organizations that embrace these principles outperform their competitors by up to 40%. Here's what the data tells us:

- **Efficiency gains**: Streamlined processes reduce operational costs
- **Competitive advantage**: Early adopters capture market share faster
- **Scalability**: Build systems that grow with your business

## Core Principles to Follow

### 1. Start with a Clear Strategy
Before diving in, define your goals and success metrics. A well-defined strategy eliminates guesswork and keeps your team aligned toward measurable outcomes.

### 2. Leverage the Right Tools
The tools you choose determine your ceiling. Invest in solutions that integrate seamlessly with your existing workflow and provide actionable insights.

### 3. Iterate and Optimize
The best performers continuously test, measure, and refine their approach. Treat every campaign or initiative as a learning opportunity.

## Conclusion

Success in this space requires commitment, the right mindset, and a willingness to adapt. Start small, measure everything, and scale what works. The organizations that thrive will be those that act decisively today.

*Ready to take the next step? The time to act is now.*`,

  ad_copy: (prompt) => `🔥 STOP SCROLLING — This Changes Everything

Tired of the same old results? It's time for a breakthrough.

Introducing the solution to ${prompt.slice(0, 40)} — designed for people who demand more.

✅ Proven to deliver results in 30 days or less
✅ Trusted by 10,000+ customers worldwide
✅ Backed by our 100% satisfaction guarantee

Here's what our customers are saying:
*"This completely transformed how I work. I wish I'd found it sooner."* — Sarah M.

Don't let another day go by without the results you deserve.

👉 **CLAIM YOUR SPOT NOW** — Limited availability this month.

⏰ Offer expires soon. Act before it's gone.`,

  email: (prompt) => `Subject: Quick question about ${prompt.slice(0, 40)}

Hi [Name],

I hope this message finds you well.

I'm reaching out because I've been following your work and I genuinely believe there's an opportunity here that aligns perfectly with what you're focused on.

Specifically, regarding ${prompt}, I've been thinking about how we could approach this differently to get significantly better results. Based on what I've seen work in similar situations, there are three key things that make all the difference:

1. A clear, outcome-focused approach from day one
2. Regular check-ins to ensure alignment
3. Data-driven decision making at every stage

I'd love to schedule a 15-minute call this week to explore whether there's a fit. Would Tuesday or Wednesday work for you?

Looking forward to connecting.

Best regards,
[Your Name]
[Title] | [Company]
[Phone] | [Email]`,

  social: (prompt) => `🚀 Big things are happening.

We've been working behind the scenes on something that's about to change the game for ${prompt.slice(0, 40)}.

Here's what we know:
→ The old way is broken
→ There's a smarter approach
→ And we're about to show you exactly what it looks like

Stay tuned. You won't want to miss this.

Drop a 🔥 in the comments if you're ready.

#Innovation #Growth #ComingSoon #${prompt.split(' ')[0] || 'ContentAI'}`,

  proposal: (prompt) => `# Business Proposal: ${prompt.slice(0, 60)}

## Executive Summary

We propose a comprehensive solution addressing ${prompt}. This proposal outlines our approach, methodology, timeline, and investment required to deliver measurable results.

## Problem Statement

Current approaches to this challenge result in:
- Wasted resources and inefficient processes
- Missed opportunities for growth
- Lack of scalable, sustainable outcomes

## Proposed Solution

Our solution provides a structured, proven framework that delivers:

**Phase 1 — Discovery & Strategy (Weeks 1-2)**
Full audit of current state and definition of success metrics.

**Phase 2 — Implementation (Weeks 3-6)**
Hands-on execution with weekly progress reports.

**Phase 3 — Optimization & Handover (Weeks 7-8)**
Fine-tuning based on data and complete knowledge transfer.

## Investment & ROI

| Package | Investment | Expected ROI |
|---------|------------|--------------|
| Standard | $5,000 | 3x within 6 months |
| Premium | $12,000 | 5x within 6 months |

## Next Steps

1. Schedule a discovery call (30 minutes)
2. Review and sign the engagement agreement
3. Kick-off meeting with your team

We're excited about the opportunity to work together. Please don't hesitate to reach out with any questions.`,

  youtube: (prompt) => `**TITLE OPTIONS**
1. ${prompt.split('\n')[0]?.replace('Video Topic: ', '').slice(0, 50)} (You Need to See This)
2. I Tested Every Method For ${prompt.split('\n')[0]?.replace('Video Topic: ', '').slice(0, 40)} — Here's What Actually Works
3. The Truth About ${prompt.split('\n')[0]?.replace('Video Topic: ', '').slice(0, 45)} Nobody Tells You
4. Stop Doing This If You Want ${prompt.split('\n')[0]?.replace('Video Topic: ', '').slice(0, 35)} (Do This Instead)
5. How I ${prompt.split('\n')[0]?.replace('Video Topic: ', '').slice(0, 50)} in 30 Days

---

**DESCRIPTION**
🔥 In this video, I'm breaking down everything you need to know about ${prompt.split('\n')[0]?.replace('Video Topic: ', '').slice(0, 60)}.

Whether you're just starting out or looking to level up, this is the most comprehensive breakdown you'll find — and I'm holding nothing back.

⏰ TIMESTAMPS:
00:00 - Introduction & What You'll Learn
02:15 - Common Mistakes to Avoid
05:30 - Step-by-Step Breakdown
10:45 - Advanced Strategies
15:20 - Real Results & Case Studies
18:00 - Action Plan & Next Steps

📌 RESOURCES MENTIONED:
→ [Tool/Resource 1] - [Link]
→ [Tool/Resource 2] - [Link]
→ Free guide: [Link]

👇 DROP A COMMENT: What's your biggest challenge with this topic? I read every reply.

🔔 Subscribe + hit the bell so you never miss a video: [Channel Link]

📸 Let's connect:
→ Instagram: @YourHandle
→ Twitter/X: @YourHandle
→ Newsletter: [Link]

---

**TAGS**
${prompt.split('\n')[0]?.replace('Video Topic: ', '').split(' ').slice(0, 3).join(', ')}, how to, tutorial, step by step, beginner guide, tips and tricks, 2024, best method, complete guide, results, strategy, growth, productivity, success, real talk`,

  upwork: (prompt) => `Hi there,

I noticed you're looking for help with ${prompt.split('\n')[0]?.replace('Job Title: ', '').slice(0, 60)} — this is exactly the type of project I specialize in, and I'd love to discuss how I can deliver exactly what you need.

**My Approach:**
→ Discovery call to fully align on your requirements and success criteria
→ Detailed project plan with milestones and regular progress updates
→ Agile development with your feedback built into every phase
→ Thorough testing before final delivery + post-launch support

**Why I'm the right fit:**
I've completed 50+ similar projects with consistent 5-star reviews. My clients specifically mention my communication, attention to detail, and ability to deliver on time — every time.

Recent example: I helped a similar client cut their project delivery time by 40% while staying under budget. I can share the case study on our call.

I'm available to start immediately and can realistically deliver this within [timeline based on scope].

Would you be open to a quick 15-minute call this week to see if we're a good fit? I have a few questions that would help me give you a more accurate proposal.

Looking forward to hearing from you,
[Your Name]

P.S. My full portfolio is on my profile — happy to share relevant code samples or past deliverables on request.`,

  fiverr_gig: (prompt) => {
    const service = prompt.split('\n')[0]?.replace('Service: ', '') || 'professional service'
    return `**GIG TITLE**
I will build a professional ${service.slice(0, 55)} for your business

---

**GIG DESCRIPTION**
Are you looking for a professional, results-driven ${service} that actually delivers? You've come to the right place.

I specialize in creating high-quality ${service} solutions that are tailored to your specific needs — not cookie-cutter templates that look like everyone else's.

What makes me different?
✔ I focus on YOUR goals and business outcomes, not just the deliverable
✔ Clean, professional work with attention to every detail
✔ Fast turnaround without sacrificing quality
✔ Clear communication throughout the entire process

I've helped 100+ clients achieve their goals with ${service}, and I'm ready to do the same for you.

Ready to get started? Order now or send me a message — I respond within 1 hour.

---

**PACKAGES**

🟢 BASIC — Starter ($75 | 3 days delivery)
• Core ${service} setup
• Responsive & mobile-friendly
• 2 rounds of revisions
• Source files included
• Basic documentation

⭐ STANDARD — Professional ($200 | 5 days delivery) ← Most Popular
• Everything in Basic
• Premium design & advanced features
• SEO/performance optimization
• 4 rounds of revisions
• Priority support
• 30-day post-delivery support

👑 PREMIUM — Enterprise ($450 | 7 days delivery)
• Everything in Standard
• Full custom solution from scratch
• Advanced integrations
• Unlimited revisions
• Dedicated project manager
• 60-day post-delivery support
• Training & handover documentation

---

**TAGS**
${service.split(' ').slice(0, 2).join(' ')}, professional design, custom solution, fast delivery, business

---

**FAQ**

Q: Can you work with my existing project/files?
A: Absolutely! Just share what you have and I'll integrate seamlessly with your current setup.

Q: What if I need changes after delivery?
A: All packages include revision rounds. Premium buyers also get 60 days of post-delivery support for any tweaks.

Q: How do we get started?
A: Send me a message with your requirements before ordering — I'll confirm I'm the right fit and give you a realistic timeline.`
  },

  linkedin: (prompt) => `I made a mistake that cost me 6 months of progress.

Here's what I learned — so you don't have to repeat it:

Most people approach ${prompt.split('\n')[0]?.replace('Topic: ', '').slice(0, 50)} the wrong way.

They focus on the tactics.
They copy what worked for someone else.
They measure the wrong things.

And then they wonder why they're not getting results.

Here's what actually moves the needle:

→ Start with a clear outcome, not an activity
→ Build systems that compound over time
→ Measure inputs, not just outputs
→ Adjust early, not after months of wasted effort

The people winning right now aren't smarter than you.

They just stopped guessing and started executing with intention.

I've seen this shift transform results for dozens of people in my network — and it can do the same for you.

What's the one thing you wish you'd known earlier about ${prompt.split('\n')[0]?.replace('Topic: ', '').split(' ').slice(0, 4).join(' ')}?

Drop it in the comments — let's build something valuable here. 👇

---

#Growth #Mindset #Strategy #Entrepreneurship #Leadership`,

  product: (prompt) => `## ${prompt.slice(0, 60)}

Experience the difference that premium quality makes.

**Why You'll Love It**

Designed for those who refuse to settle, this product delivers on every promise. From the moment you unbox it, you'll notice the attention to detail that sets it apart from everything else on the market.

**Key Features**
- ⚡ **Performance-engineered** for peak efficiency
- 🛡️ **Built to last** with premium materials
- 🎯 **Intuitive design** that works the way you think
- 📦 **Ready to use** right out of the box

**What Customers Say**

*"Best purchase I've made this year. Exceeded every expectation."* ★★★★★

**Specifications**
- Material: Premium grade components
- Warranty: 2-year comprehensive coverage
- Support: 24/7 customer service

**Ready to upgrade?**

Add to cart today and experience the premium difference. Free shipping on orders over $50 • 30-day hassle-free returns.`,
}

// ─── Main generate function ───────────────────────────────────────────────────

const generateContent = async ({ contentType, tone, length, prompt }) => {
  const gemini = getGemini()

  if (gemini) {
    try {
      const fullPrompt = buildPrompt({ contentType, tone, length, prompt })
      const result = await gemini.generateContent(fullPrompt)
      const output = result.response.text()

      // Gemini doesn't return token counts on flash model reliably — estimate
      const tokensUsed = output.split(/\s+/).length * 1.3

      return { output, tokensUsed: Math.round(tokensUsed), source: 'gemini' }
    } catch (err) {
      console.warn('⚠️  Gemini call failed, falling back to mock:', err.message)
    }
  }

  // Mock fallback — works with no API key
  await new Promise((r) => setTimeout(r, 600)) // simulate latency
  const mockFn = MOCK_OUTPUTS[contentType] || MOCK_OUTPUTS.blog
  const output = mockFn(prompt)
  const tokensUsed = LENGTH_TOKENS[length] || 400

  return { output, tokensUsed, source: 'mock' }
}

module.exports = { generateContent }
