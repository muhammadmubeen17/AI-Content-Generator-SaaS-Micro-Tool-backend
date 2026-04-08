require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const mongoose = require('mongoose')
const User = require('../models/User')
const Template = require('../models/Template')
const connectDB = require('../config/db')

const SEED_TEMPLATES = [
  {
    title: 'Blog Writer',
    description: 'Generate SEO-optimized blog posts on any topic with a clear structure and engaging content.',
    category: 'Content',
    icon: 'FileText',
    contentType: 'blog',
    defaultTone: 'informative',
    defaultLength: 'long',
    promptStructure: 'Write a comprehensive blog post about {topic}. Target keywords: {keywords}. Make it engaging and SEO-friendly.',
    fields: [
      { name: 'topic', label: 'Blog Topic', type: 'text', placeholder: 'e.g. The future of AI in healthcare', required: true },
      { name: 'keywords', label: 'Target Keywords', type: 'text', placeholder: 'e.g. AI, healthcare, automation' },
      { name: 'audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. Healthcare professionals' },
    ],
  },
  {
    title: 'Ad Copy Generator',
    description: 'Write persuasive ad copy for Facebook, Google, Instagram, and more that drives conversions.',
    category: 'Marketing',
    icon: 'Megaphone',
    contentType: 'ad_copy',
    defaultTone: 'persuasive',
    defaultLength: 'short',
    promptStructure: 'Write compelling ad copy for {platform} promoting {product}. Target audience: {audience}. Key benefit: {benefit}.',
    fields: [
      { name: 'platform', label: 'Ad Platform', type: 'select', options: ['Facebook', 'Google', 'Instagram', 'LinkedIn', 'Twitter'], required: true },
      { name: 'product', label: 'Product / Service', type: 'text', placeholder: 'e.g. Fitness app for busy professionals', required: true },
      { name: 'audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. Working parents aged 25-45' },
      { name: 'benefit', label: 'Key Benefit', type: 'text', placeholder: 'e.g. Save 2 hours a day' },
    ],
  },
  {
    title: 'Email Writer',
    description: 'Craft professional, personalized emails for any business occasion that get replies.',
    category: 'Communication',
    icon: 'Mail',
    contentType: 'email',
    defaultTone: 'professional',
    defaultLength: 'medium',
    promptStructure: 'Write a professional {type} email to {recipient} about {subject}. Goal: {goal}.',
    fields: [
      { name: 'type', label: 'Email Type', type: 'select', options: ['Follow-up', 'Cold outreach', 'Thank you', 'Proposal', 'Apology', 'Announcement'], required: true },
      { name: 'recipient', label: 'Recipient', type: 'text', placeholder: 'e.g. Potential client, Team member', required: true },
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g. Following up on our meeting', required: true },
      { name: 'goal', label: 'Email Goal', type: 'text', placeholder: 'e.g. Schedule a 30-minute call' },
    ],
  },
  {
    title: 'Product Description',
    description: 'Write compelling product descriptions that highlight benefits and drive purchase decisions.',
    category: 'E-commerce',
    icon: 'ShoppingBag',
    contentType: 'product',
    defaultTone: 'persuasive',
    defaultLength: 'medium',
    promptStructure: 'Write a compelling product description for {product}. Key features: {features}. Target buyer: {buyer}.',
    fields: [
      { name: 'product', label: 'Product Name', type: 'text', placeholder: 'e.g. Wireless Noise-Cancelling Headphones', required: true },
      { name: 'features', label: 'Key Features', type: 'textarea', placeholder: 'List the main features, one per line', required: true },
      { name: 'buyer', label: 'Target Buyer', type: 'text', placeholder: 'e.g. Remote workers, audiophiles' },
      { name: 'pricePoint', label: 'Price Point', type: 'select', options: ['Budget-friendly', 'Mid-range', 'Premium', 'Luxury'] },
    ],
  },
  {
    title: 'Social Media Post',
    description: 'Create engaging, platform-optimized posts for Instagram, LinkedIn, Twitter, and more.',
    category: 'Social',
    icon: 'Share2',
    contentType: 'social',
    defaultTone: 'casual',
    defaultLength: 'short',
    promptStructure: 'Write an engaging {platform} post about {topic}. Call to action: {cta}. Include relevant hashtags: {hashtags}.',
    fields: [
      { name: 'platform', label: 'Platform', type: 'select', options: ['Instagram', 'LinkedIn', 'Twitter/X', 'Facebook', 'TikTok'], required: true },
      { name: 'topic', label: 'Post Topic', type: 'text', placeholder: 'e.g. New product launch', required: true },
      { name: 'cta', label: 'Call to Action', type: 'text', placeholder: 'e.g. Shop now, Learn more, Comment below' },
      { name: 'hashtags', label: 'Include Hashtags?', type: 'select', options: ['Yes', 'No'] },
    ],
  },
  {
    title: 'Business Proposal',
    description: 'Generate professional business proposals that win clients and close deals.',
    category: 'Business',
    icon: 'FileSignature',
    contentType: 'proposal',
    defaultTone: 'formal',
    defaultLength: 'long',
    promptStructure: 'Write a professional business proposal for {client} for the project: {project}. Budget: {budget}. Timeline: {timeline}.',
    fields: [
      { name: 'client', label: 'Client / Company', type: 'text', placeholder: 'e.g. Acme Corp', required: true },
      { name: 'project', label: 'Project Description', type: 'textarea', placeholder: 'Describe what you will deliver', required: true },
      { name: 'budget', label: 'Project Budget', type: 'text', placeholder: 'e.g. $5,000 - $10,000' },
      { name: 'timeline', label: 'Timeline', type: 'text', placeholder: 'e.g. 4-6 weeks' },
    ],
  },
]

const SEED_ADMIN = {
  name: 'Admin User',
  email: 'admin@contentai.io',
  password: 'Admin1234',
  role: 'admin',
  plan: 'premium',
  credits: 1000,
  totalCredits: 1000,
}

const SEED_USER = {
  name: 'Demo User',
  email: 'demo@contentai.io',
  password: 'Demo1234',
  role: 'user',
  plan: 'pro',
  credits: 142,
  totalCredits: 200,
}

const seed = async () => {
  await connectDB()
  console.log('\n🌱 Starting database seed...\n')

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Template.deleteMany({}),
  ])
  console.log('🗑️  Cleared existing Users and Templates')

  // Create users
  const [admin, demoUser] = await Promise.all([
    User.create(SEED_ADMIN),
    User.create(SEED_USER),
  ])
  console.log(`✅ Created admin: ${admin.email}`)
  console.log(`✅ Created demo user: ${demoUser.email}`)

  // Create templates
  const templates = await Template.insertMany(
    SEED_TEMPLATES.map((t) => ({ ...t, createdBy: admin._id }))
  )
  console.log(`✅ Created ${templates.length} templates`)

  console.log('\n🎉 Seed complete!\n')
  console.log('─'.repeat(40))
  console.log('Test Accounts:')
  console.log(`  Admin : admin@contentai.io / Admin1234`)
  console.log(`  User  : demo@contentai.io  / Demo1234`)
  console.log('─'.repeat(40) + '\n')

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
