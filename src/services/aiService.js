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
