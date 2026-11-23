/**
 * Knotiq Rugs Production Data Seeder
 * Populates 100% authentic, production-grade business data for Knotiq Rugs
 * across all models in the Knotiq Command Center.
 *
 * Target User: 'admin_user_knotiq' (Local SQLite environment)
 */

const {
  sequelize,
  UserSettings,
  MindsetQuote,
  MindsetGateLog,
  Lead,
  Call,
  CallScript,
  FollowUp,
  Task,
  Note,
  CalendarEvent,
  DailyPlan,
  DailyReview,
  OutreachLog,
  OutreachTemplate,
  Campaign,
  CampaignLead,
  ContentPost,
  Mindmap,
  MindmapNode,
  SearchPreset,
  Schedule,
  OptOut,
  AuditLog
} = require('../models');
const logger = require('../config/logger');

const USER_ID = 'admin_user_knotiq';

async function seedKnotiqProductionData() {
  await sequelize.authenticate();
  logger.info({ userId: USER_ID }, 'Beginning Knotiq Rugs Production Data Seeding...');

  // Derive dates in Asia/Dubai timezone (UTC+4)
  const now = new Date();
  const getDubaiDateStr = (d) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  };

  const todayStr = getDubaiDateStr(now);

  const daysAgoStr = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return getDubaiDateStr(d);
  };

  const dMinus4 = daysAgoStr(4);
  const dMinus3 = daysAgoStr(3);
  const dMinus2 = daysAgoStr(2);
  const dMinus1 = daysAgoStr(1);

  // Today dates for timestamps
  const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
  const noonToday = new Date(`${todayStr}T08:00:00.000Z`); // 12:00 GST
  const yesterdayNoon = new Date(`${dMinus1}T08:00:00.000Z`);

  // ==========================================
  // Clean up existing records in dependency order (children first)
  // ==========================================
  logger.info('Cleaning up existing records for user in dependency order...');
  await MindmapNode.destroy({ where: { userId: USER_ID } });
  await Mindmap.destroy({ where: { userId: USER_ID } });
  await CampaignLead.destroy({ where: { userId: USER_ID } });
  await ContentPost.destroy({ where: { userId: USER_ID } });
  await Campaign.destroy({ where: { userId: USER_ID } });
  await OutreachTemplate.destroy({ where: { userId: USER_ID } });
  await Call.destroy({ where: { userId: USER_ID } });
  await CallScript.destroy({ where: {} });
  await FollowUp.destroy({ where: { userId: USER_ID } });
  await CalendarEvent.destroy({ where: { userId: USER_ID } });
  await Task.destroy({ where: { userId: USER_ID } });
  await Note.destroy({ where: { userId: USER_ID } });
  await OutreachLog.destroy({ where: { userId: USER_ID } });
  await DailyPlan.destroy({ where: { userId: USER_ID } });
  await DailyReview.destroy({ where: { userId: USER_ID } });
  await Lead.destroy({ where: { userId: USER_ID } });
  await MindsetQuote.destroy({ where: { userId: USER_ID } });
  await MindsetGateLog.destroy({ where: { userId: USER_ID } });
  await SearchPreset.destroy({ where: { userId: USER_ID } });
  await Schedule.destroy({ where: { userId: USER_ID } });

  // ==========================================
  // 1. User Settings
  // ==========================================
  logger.info('1. Seeding UserSettings...');
  let settings = await UserSettings.findOne({ where: { userId: USER_ID } });
  const settingsData = {
    userId: USER_ID,
    timezone: 'Asia/Dubai',
    dailyEmailTarget: 30,
    dailyWhatsappTarget: 30,
    dailyCallTarget: 20,
    notifyTelegram: true,
    notifyEmail: true,
    morningBriefTime: '08:30',
    eveningNudgeTime: '18:30',
    eventReminderMinutes: 15,
    remindersEnabled: true,
    weeklyPostTarget: 5,
    contentReminderTime: '10:00',
    gateMode: 'once_daily',
    gateResetHour: 0,
    gateLanguage: 'en-IN',
    gateMatchThreshold: 0.8,
    gateFallbackAfterAttempts: 3,
    gateStrictnessEffectiveNextDay: true,
    pendingGateMode: null,
    pendingGateMatchThreshold: null,
    pendingEffectiveDate: null
  };

  if (settings) {
    await settings.update(settingsData);
  } else {
    settings = await UserSettings.create(settingsData);
  }

  // ==========================================
  // 2. Mindset Quotes (5 Active Mantras)
  // ==========================================
  logger.info('2. Seeding Mindset Quotes...');

  const quotesData = [
    {
      userId: USER_ID,
      text: 'Every knot tied in Bhadohi represents generations of heritage; honor their craftsmanship in every client conversation.',
      author: 'Founder Ritual',
      language: 'en-IN',
      sortOrder: 0,
      isActive: true
    },
    {
      userId: USER_ID,
      text: 'Relentless outreach builds sovereign empires; 20 calls, 30 emails, 30 WhatsApps daily without compromise.',
      author: 'Commercial Discipline',
      language: 'en-IN',
      sortOrder: 1,
      isActive: true
    },
    {
      userId: USER_ID,
      text: 'We do not sell rugs; we deliver bespoke architectural centerpieces that elevate luxury spaces.',
      author: 'Brand Positioning',
      language: 'en-IN',
      sortOrder: 2,
      isActive: true
    },
    {
      userId: USER_ID,
      text: 'Respect the loom, revere the artisan, and relentlessly exceed the expectations of our trade partners.',
      author: 'Artisan Standard',
      language: 'en-IN',
      sortOrder: 3,
      isActive: true
    },
    {
      userId: USER_ID,
      text: 'Focus on high-conviction luxury interior designers and turnkey fit-out leaders across the GCC.',
      author: 'Market Strategy',
      language: 'en-IN',
      sortOrder: 4,
      isActive: true
    }
  ];

  await MindsetQuote.bulkCreate(quotesData);

  // ==========================================
  // 3. Mindset Gate Logs (5 Consecutive Days Streak)
  // ==========================================
  logger.info('3. Seeding Mindset Gate Logs...');

  const streakDates = [dMinus4, dMinus3, dMinus2, dMinus1, todayStr];
  for (let i = 0; i < streakDates.length; i++) {
    const gDate = streakDates[i];
    const started = new Date(`${gDate}T04:15:00.000Z`); // 08:15 GST
    const completed = new Date(`${gDate}T04:18:30.000Z`); // 08:18 GST
    await MindsetGateLog.create({
      userId: USER_ID,
      gateDate: gDate,
      startedAt: started,
      completedAt: completed,
      method: i === 2 ? 'mixed' : 'voice',
      attemptsTotal: 5,
      quotesCompleted: 5,
      quotesTyped: i === 2 ? 1 : 0
    });
  }

  // ==========================================
  // 4. B2B Leads (12 Authentic Luxury Entities)
  // ==========================================
  logger.info('4. Seeding B2B Leads...');

  const leadsInput = [
    {
      userId: USER_ID,
      businessName: 'Mirage Hospitality Projects LLC',
      leadType: 'Hospitality Procurement & Fit-Out',
      subCategory: 'Luxury Resort FF&E',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Suite 1802, Boulevard Plaza Tower 1, Downtown Dubai',
      postalCode: 'PO Box 41829',
      lat: 25.1972,
      lng: 55.2744,
      phone: '+971 4 429 8810',
      whatsapp: '+971 50 812 4432',
      email: 'procurement@mirage-hospitality.ae',
      emailVerified: 'mx_ok',
      website: 'https://mirage-hospitality.ae',
      domain: 'mirage-hospitality.ae',
      googleMapsUrl: 'https://maps.google.com/?q=Boulevard+Plaza+Tower+1+Dubai',
      rating: 4.8,
      reviewCount: 34,
      linkedin: 'https://linkedin.com/company/mirage-hospitality-me',
      instagram: 'https://instagram.com/mirage_hospitality',
      sellsRugsSignal: true,
      productNotes: 'Seeking 45 bespoke 100% New Zealand wool rugs for 5-star boutique resort suites in Ras Al Khaimah. Fire rating CRI Green Label Plus required.',
      source: 'google_places',
      sourceUrl: 'https://google.com/maps',
      language: 'en',
      score: 95,
      scoreReason: 'Active RFP in progress; high budget (AED 185,000); direct loom sourcing advantage.',
      buyerType: 'hospitality',
      buyerTypeConfidence: 0.98,
      buyerTypeReason: 'Procures luxury FF&E carpet and rug packages for luxury hotels and beach resorts.',
      buyerTypeManual: true,
      priority: 'hot',
      assignedTo: 'Zishan Ansari',
      project: 'RAK Luxury Beachfront Resort 2026',
      platform: 'Google Maps UAE',
      sizes: 'Bespoke 3x4m and 4x5m cut pile',
      dealValue: 185000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'quotation',
      notes: 'Meeting held with Tariq Al-Hashimi (Director of FF&E). Sample strike-off pom-poms sent to Boulevard Plaza.',
      tags: ['hospitality', 'resort', 'hand-knotted', 'new-zealand-wool', 'rfp-q1'],
      dedupeKey: 'lead:mirage_hospitality_dubai',
      lastContactedAt: new Date(`${todayStr}T06:30:00.000Z`),
      nextFollowUpAt: new Date(`${todayStr}T11:00:00.000Z`)
    },
    {
      userId: USER_ID,
      businessName: 'Atelier Luxe Living Interior Design',
      leadType: 'High-End Residential Interior Designer',
      subCategory: 'Turnkey Luxury Villas',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Warehouse 14, Alserkal Avenue, Al Quoz 1, Dubai',
      postalCode: 'PO Box 12849',
      lat: 25.1415,
      lng: 55.2268,
      phone: '+971 4 340 7621',
      whatsapp: '+971 52 690 1184',
      email: 'elena@atelierluxeliving.ae',
      emailVerified: 'mx_ok',
      website: 'https://atelierluxeliving.ae',
      domain: 'atelierluxeliving.ae',
      rating: 4.9,
      reviewCount: 48,
      instagram: 'https://instagram.com/atelierluxeliving',
      sellsRugsSignal: true,
      productNotes: 'Palm Jumeirah Signature Villa master suite and formal living room. Requires hand-knotted botanical silk with washed abrash finish.',
      source: 'houzz',
      sourceUrl: 'https://houzz.com/professionals/interior-designers/atelier-luxe-living',
      language: 'en',
      score: 92,
      scoreReason: 'Prestigious Palm Jumeirah villa project; high repeat potential for trade designer accounts.',
      buyerType: 'interior_designer',
      buyerTypeConfidence: 0.95,
      buyerTypeReason: 'Curates bespoke furnishings, rugs, and lighting for ultra-HNW residences.',
      buyerTypeManual: true,
      priority: 'hot',
      assignedTo: 'Zishan Ansari',
      project: 'Palm Jumeirah Frond N Signature Villa',
      dealValue: 92000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'sample_sent',
      notes: 'Elena Rostova loved the 80-knot hand-knotted sample box. Awaiting CAD dimension approval.',
      tags: ['palm-jumeirah', 'botanical-silk', 'bespoke-sizing', 'sample-sent'],
      dedupeKey: 'lead:atelier_luxe_living_dubai',
      lastContactedAt: new Date(`${dMinus1}T10:00:00.000Z`),
      nextFollowUpAt: new Date(`${todayStr}T09:30:00.000Z`)
    },
    {
      userId: USER_ID,
      businessName: 'Roar Architecture & Design Studio',
      leadType: 'Commercial Architect & Workplace Specifier',
      subCategory: 'Executive Corporate Headquarters',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Office 402, Building 7, Dubai Design District (d3), Dubai',
      postalCode: 'PO Box 33312',
      lat: 25.1873,
      lng: 55.2974,
      phone: '+971 4 553 9820',
      whatsapp: '+971 55 319 7702',
      email: 'david.h@designbyroar.com',
      emailVerified: 'mx_ok',
      website: 'https://designbyroar.com',
      domain: 'designbyroar.com',
      rating: 4.9,
      reviewCount: 72,
      instagram: 'https://instagram.com/designbyroar',
      linkedin: 'https://linkedin.com/company/designbyroar',
      sellsRugsSignal: true,
      productNotes: 'Executive investment bank headquarters in DIFC. 18 acoustic flatweave carpets and central boardroom hand-knotted rug (6x8 meters).',
      source: 'd3_directory',
      sourceUrl: 'https://dubaidesigndistrict.com',
      language: 'en',
      score: 94,
      scoreReason: 'Tier-1 d3 studio; large commercial budget (AED 240,000); contract signing imminent.',
      buyerType: 'architect',
      buyerTypeConfidence: 0.96,
      buyerTypeReason: 'Top architectural practice specifying corporate and hospitality floorings across UAE.',
      buyerTypeManual: true,
      priority: 'hot',
      assignedTo: 'Zishan Ansari',
      project: 'DIFC Gate Precinct Investment Bank HQ',
      dealValue: 240000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'negotiation',
      notes: 'Meeting scheduled with David Henderson at d3 Building 7 at 16:30 today.',
      tags: ['d3', 'difc', 'commercial', 'acoustic-flatweave', 'trade-discount'],
      dedupeKey: 'lead:roar_design_d3',
      lastContactedAt: new Date(`${dMinus2}T12:00:00.000Z`),
      nextFollowUpAt: new Date(`${todayStr}T12:30:00.000Z`)
    },
    {
      userId: USER_ID,
      businessName: 'Summertown Interiors & Turnkey Fit-Out',
      leadType: 'Turnkey Fit-Out Contractor',
      subCategory: 'LEED Certified Fit-Outs',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'JAFZA One, Tower A, Jebel Ali Free Zone, Dubai',
      postalCode: 'PO Box 26233',
      lat: 24.9857,
      lng: 55.0931,
      phone: '+971 4 805 3300',
      whatsapp: '+971 50 491 8830',
      email: 'mvance@summertown.ae',
      emailVerified: 'mx_ok',
      website: 'https://summertown.ae',
      domain: 'summertown.ae',
      rating: 4.7,
      reviewCount: 56,
      linkedin: 'https://linkedin.com/company/summertown-interiors',
      sellsRugsSignal: true,
      productNotes: 'LEED-certified luxury penthouse fit-out on Bluewaters Island. Need low-VOC yarn certifications and natural vegetable dyes.',
      source: 'google_places',
      sourceUrl: 'https://google.com/maps',
      language: 'en',
      score: 86,
      scoreReason: 'Established sustainable contractor; recurring commercial pipeline.',
      buyerType: 'fitout',
      buyerTypeConfidence: 0.94,
      buyerTypeReason: 'Specialist turnkey fit-out contractor executing luxury and green commercial projects.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'Bluewaters Island Luxury Penthouse',
      dealValue: 145000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'contacted',
      notes: 'Overdue follow-up for CAD drawings with floor electrical box positions.',
      tags: ['fitout', 'leed-green', 'bluewaters', 'low-voc'],
      dedupeKey: 'lead:summertown_jafza',
      lastContactedAt: new Date(`${dMinus3}T09:00:00.000Z`),
      nextFollowUpAt: new Date(`${dMinus1}T10:00:00.000Z`) // Overdue intentionally for dashboard alert
    },
    {
      userId: USER_ID,
      businessName: 'The Oriental & Modern Carpet Gallery',
      leadType: 'Luxury Flooring Retailer',
      subCategory: 'High-End Retail Showroom',
      country: 'United Arab Emirates',
      state: 'Abu Dhabi',
      city: 'Abu Dhabi',
      address: 'Corniche Road West, Al Ras Al Akhdar, Abu Dhabi',
      postalCode: 'PO Box 3910',
      lat: 24.4712,
      lng: 54.3218,
      phone: '+971 2 681 5520',
      whatsapp: '+971 50 722 9901',
      email: 'fatima@orientalcarpetgallery.ae',
      emailVerified: 'mx_ok',
      website: 'https://orientalcarpetgallery.ae',
      domain: 'orientalcarpetgallery.ae',
      rating: 4.6,
      reviewCount: 31,
      sellsRugsSignal: true,
      productNotes: 'Showroom consignment of 15 pieces of 60-knot Bhadohi hand-knotted runners and wool-silk living accents for Abu Dhabi royal families.',
      source: 'yellow_pages_ae',
      sourceUrl: 'https://yellowpages.ae',
      language: 'en',
      score: 84,
      scoreReason: 'Prime Corniche showroom; wholesale recurring retail order potential.',
      buyerType: 'retailer',
      buyerTypeConfidence: 0.97,
      buyerTypeReason: 'Retail gallery selling oriental and modern carpets directly to high-net-worth consumers.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'Abu Dhabi Showroom Winter Collection Consignment',
      dealValue: 120000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'replied',
      notes: 'Fatima Al-Mansouri requested wholesale B2B pricing sheet in AED/sqm.',
      tags: ['retailer', 'abu-dhabi', 'consignment', 'runners'],
      dedupeKey: 'lead:oriental_carpet_gallery_ad',
      lastContactedAt: new Date(`${dMinus2}T14:00:00.000Z`),
      nextFollowUpAt: new Date(`${todayStr}T14:00:00.000Z`)
    },
    {
      userId: USER_ID,
      businessName: 'Killa Design Architectural Consultants',
      leadType: 'Luxury Villa & Branded Residence Architect',
      subCategory: 'Iconic Architecture & Super-Prime Living',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Concord Tower, Media City, Dubai',
      postalCode: 'PO Box 50222',
      lat: 25.0935,
      lng: 55.1561,
      phone: '+971 4 447 2120',
      whatsapp: '+971 54 220 3389',
      email: 'laila@killadesign.com',
      emailVerified: 'mx_ok',
      website: 'https://killadesign.com',
      domain: 'killadesign.com',
      rating: 5.0,
      reviewCount: 88,
      linkedin: 'https://linkedin.com/company/killa-design',
      instagram: 'https://instagram.com/killadesign_',
      sellsRugsSignal: true,
      productNotes: 'Business Bay canal-front ultra-luxury penthouse pentagonal rug shapes requiring custom loom setup at Bhadohi workshop.',
      source: 'architects_uae',
      sourceUrl: 'https://architects.ae',
      language: 'en',
      score: 96,
      scoreReason: 'Mastermind behind Museum of the Future; super-prime residential interior specifications.',
      buyerType: 'architect',
      buyerTypeConfidence: 0.98,
      buyerTypeReason: 'World-renowned architectural studio specifying custom bespoke furnishings.',
      buyerTypeManual: true,
      priority: 'hot',
      assignedTo: 'Zishan Ansari',
      project: 'Business Bay Canal-Front Penthouse Masterpiece',
      dealValue: 310000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'sample_sent',
      notes: 'Shipped custom pentagon strike-off and natural wool tufts. Follow up on Tuesday.',
      tags: ['architect', 'penthouse', 'custom-shape', 'oversized'],
      dedupeKey: 'lead:killa_design_dubai',
      lastContactedAt: new Date(`${dMinus2}T11:00:00.000Z`),
      nextFollowUpAt: new Date(Date.now() + 2 * 86400000)
    },
    {
      userId: USER_ID,
      businessName: 'Zen Interiors LLC',
      leadType: 'Turnkey Residential Furnishing Studio',
      subCategory: 'Luxury Villa Turnkey Staging',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Esse Tower, Barsha Heights (TECOM), Dubai',
      postalCode: 'PO Box 74411',
      lat: 25.0998,
      lng: 55.1764,
      phone: '+971 4 340 5050',
      whatsapp: '+971 50 914 2261',
      email: 'procurement@zeninteriors.com',
      emailVerified: 'mx_ok',
      website: 'https://zeninteriors.com',
      domain: 'zeninteriors.com',
      rating: 4.8,
      reviewCount: 110,
      instagram: 'https://instagram.com/zeninteriors',
      sellsRugsSignal: true,
      productNotes: 'Emirates Hills Villa 42 custom living room rug (washed abrash finish, 5x7 meters). Successfully delivered and installed.',
      source: 'houzz',
      sourceUrl: 'https://houzz.com',
      language: 'en',
      score: 90,
      scoreReason: 'Won deal closed; prompt payment; excellent referral partner for Dubai Hills and Emirates Hills villas.',
      buyerType: 'interior_designer',
      buyerTypeConfidence: 0.97,
      buyerTypeReason: 'Leading turnkey villa furnishers in UAE.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'Emirates Hills Villa 42 Living Saloon',
      dealValue: 78000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'won',
      notes: 'Client Patrick O\'Connell commended the fast airfreight from Delhi IGI to DWC and perfect tone matching.',
      tags: ['won-deal', 'emirates-hills', 'abrash-finish', 'repeat-ready'],
      dedupeKey: 'lead:zen_interiors_dubai',
      lastContactedAt: new Date(`${dMinus4}T08:00:00.000Z`),
      nextFollowUpAt: new Date(Date.now() + 10 * 86400000)
    },
    {
      userId: USER_ID,
      businessName: 'Mayfair Bespoke Living Ltd',
      leadType: 'Heritage Interior Architecture Practice',
      subCategory: 'Period Townhouses & Estates',
      country: 'United Kingdom',
      state: 'Greater London',
      city: 'London',
      address: '14 Berkeley Street, Mayfair, London W1K 8NX',
      postalCode: 'W1K 8NX',
      lat: 51.5088,
      lng: -0.1444,
      phone: '+44 20 7946 0912',
      whatsapp: '+44 77 0090 0821',
      email: 'c.davenport@mayfairbespoke.co.uk',
      emailVerified: 'mx_ok',
      website: 'https://mayfairbespoke.co.uk',
      domain: 'mayfairbespoke.co.uk',
      rating: 4.9,
      reviewCount: 29,
      instagram: 'https://instagram.com/mayfairbespokeliving',
      sellsRugsSignal: true,
      productNotes: 'Belgravia Grade II listed townhouse restoration. Requires traditional Oushak-inspired botanical dye wool rugs.',
      source: 'british_interior_design',
      sourceUrl: 'https://biid.org.uk',
      language: 'en',
      score: 85,
      scoreReason: 'UK high-value heritage residential project; GBP currency billing capability.',
      buyerType: 'interior_designer',
      buyerTypeConfidence: 0.93,
      buyerTypeReason: 'Exclusive British residential interior architectural practice.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'Belgravia Grade II Townhouse Restoration',
      dealValue: 165000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'contacted',
      notes: 'Sent PDF digital portfolio of historical Bhadohi loom revivals. Awaiting Charles Davenport response.',
      tags: ['uk-market', 'mayfair', 'oushak', 'botanical-dye'],
      dedupeKey: 'lead:mayfair_bespoke_london',
      lastContactedAt: new Date(`${dMinus3}T14:00:00.000Z`),
      nextFollowUpAt: new Date(Date.now() + 3 * 86400000)
    },
    {
      userId: USER_ID,
      businessName: 'Kingdom Hospitality Procurement',
      leadType: 'Mega-Project FF&E Procurement Agency',
      subCategory: 'Giga-Project Heritage Hotels',
      country: 'Saudi Arabia',
      state: 'Riyadh Province',
      city: 'Riyadh',
      address: 'King Fahd Road, Al Olaya, Riyadh 12213',
      postalCode: '12213',
      lat: 24.7136,
      lng: 46.6753,
      phone: '+966 11 482 9900',
      whatsapp: '+966 50 312 8871',
      email: 'o.ghamdi@kingdom-hospitality.sa',
      emailVerified: 'mx_ok',
      website: 'https://kingdom-hospitality.sa',
      domain: 'kingdom-hospitality.sa',
      rating: 4.9,
      reviewCount: 64,
      linkedin: 'https://linkedin.com/company/kingdom-hospitality-procurement',
      sellsRugsSignal: true,
      productNotes: 'Diriyah Gate boutique heritage hotel project. Inquiring for 60 guest room suites and VIP Majlis area rugs.',
      source: 'saudi_contractors',
      sourceUrl: 'https://sca.sa',
      language: 'ar',
      score: 98,
      scoreReason: 'Saudi Giga-Project scale (AED 450,000+); huge potential for Bhadohi loom volume capacity.',
      buyerType: 'hospitality',
      buyerTypeConfidence: 0.99,
      buyerTypeReason: 'Central procurement portal for luxury hotels across Riyadh and Red Sea.',
      buyerTypeManual: true,
      priority: 'hot',
      assignedTo: 'Zishan Ansari',
      project: 'Diriyah Gate Heritage Boutique Hotel',
      dealValue: 450000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'new',
      notes: 'Initial outreach sent via WhatsApp to Omar Al-Ghamdi. Courier tracking set for sample crate.',
      tags: ['saudi-vision-2030', 'diriyah-gate', 'hotel-majlis', 'high-volume'],
      dedupeKey: 'lead:kingdom_hospitality_riyadh',
      lastContactedAt: new Date(`${todayStr}T05:00:00.000Z`),
      nextFollowUpAt: new Date(`${todayStr}T13:00:00.000Z`)
    },
    {
      userId: USER_ID,
      businessName: 'Depa Interiors LLC',
      leadType: 'Global Interior Contracting Specialist',
      subCategory: 'Palatial & Hospitality Fit-Out',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Dubai Investments Park 1, Jebel Ali, Dubai',
      postalCode: 'PO Box 56329',
      lat: 24.9922,
      lng: 55.1843,
      phone: '+971 4 821 6666',
      whatsapp: '+971 50 128 9043',
      email: 'r.khalifa@depa.com',
      emailVerified: 'mx_ok',
      website: 'https://depa.com',
      domain: 'depa.com',
      rating: 4.7,
      reviewCount: 94,
      linkedin: 'https://linkedin.com/company/depa-group',
      sellsRugsSignal: true,
      productNotes: 'Presidential Palace suite guest corridors and VIP Majlis. Requesting 80-knot sample box and fire-rating lab tests.',
      source: 'google_places',
      sourceUrl: 'https://google.com/maps',
      language: 'en',
      score: 88,
      scoreReason: 'Global interior fit-out giant; large institutional project pipeline.',
      buyerType: 'fitout',
      buyerTypeConfidence: 0.96,
      buyerTypeReason: 'World leading interior contracting firm.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'Presidential Palace Suites & VIP Majlis',
      dealValue: 190000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'replied',
      notes: 'Rashed Bin Khalifa requested physical sample presentation at their DIP headquarters.',
      tags: ['depa', 'fitout', 'palace-project', 'fire-rated'],
      dedupeKey: 'lead:depa_interiors_dubai',
      lastContactedAt: new Date(`${dMinus2}T09:30:00.000Z`),
      nextFollowUpAt: new Date(Date.now() + 4 * 86400000)
    },
    {
      userId: USER_ID,
      businessName: 'Alserkal Craft & Textile Atelier',
      leadType: 'Contemporary Art & Rug Concept Store',
      subCategory: 'Curated Limited Edition Rugs',
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      address: 'Warehouse 42, Alserkal Avenue, Al Quoz 1, Dubai',
      postalCode: 'PO Box 29811',
      lat: 25.1422,
      lng: 55.2275,
      phone: '+971 4 333 8912',
      whatsapp: '+971 55 439 1088',
      email: 'noor@alserkalcraft.ae',
      emailVerified: 'mx_ok',
      website: 'https://alserkalcraft.ae',
      domain: 'alserkalcraft.ae',
      rating: 4.9,
      reviewCount: 42,
      instagram: 'https://instagram.com/alserkalcraftatelier',
      sellsRugsSignal: true,
      productNotes: 'Bi-monthly curated batch of modern hand-tufted wool rugs with high-relief sculpted pile for art collectors.',
      source: 'alserkal_directory',
      sourceUrl: 'https://alserkal.online',
      language: 'en',
      score: 89,
      scoreReason: 'Established repeat buyer in Dubai arts district; 6 drops completed in 2025/2026.',
      buyerType: 'retailer',
      buyerTypeConfidence: 0.96,
      buyerTypeReason: 'Retail gallery selling limited artisanal runs.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'Spring 2026 Art Collection Drop',
      dealValue: 85000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'repeat_client',
      notes: 'Noor Al-Kuwari ordered 8 new pieces featuring geometric Bauhaus motifs.',
      tags: ['retailer', 'art-gallery', 'hand-tufted', 'sculpted-pile'],
      dedupeKey: 'lead:alserkal_craft_atelier_dubai',
      lastContactedAt: new Date(`${dMinus3}T11:00:00.000Z`),
      nextFollowUpAt: new Date(Date.now() + 5 * 86400000)
    },
    {
      userId: USER_ID,
      businessName: 'Tribeca Loft Design Group',
      leadType: 'Luxury Manhattan Interior Studio',
      subCategory: 'Downtown Manhattan Residences',
      country: 'United States',
      state: 'New York',
      city: 'New York',
      address: 'Franklin Street, Tribeca, New York, NY 10013',
      postalCode: '10013',
      lat: 40.7183,
      lng: -74.0089,
      phone: '+1 212 555 0192',
      whatsapp: '+1 917 555 4481',
      email: 'smiller@tribecaloftdesign.com',
      emailVerified: 'mx_ok',
      website: 'https://tribecaloftdesign.com',
      domain: 'tribecaloftdesign.com',
      rating: 4.8,
      reviewCount: 37,
      instagram: 'https://instagram.com/tribecaloftdesign',
      sellsRugsSignal: true,
      productNotes: 'Tribeca and Soho duplex loft renovations. Looking for neutral oversized 10x14 ft hand-knotted wool rugs.',
      source: 'architectural_digest',
      sourceUrl: 'https://architecturaldigest.com',
      language: 'en',
      score: 82,
      scoreReason: 'US coastal luxury market; USD wire payments; high margin custom sizing.',
      buyerType: 'interior_designer',
      buyerTypeConfidence: 0.94,
      buyerTypeReason: 'High-end NYC interior studio specifying custom artisanal rugs.',
      buyerTypeManual: true,
      priority: 'warm',
      assignedTo: 'Zishan Ansari',
      project: 'SoHo Cast Iron Loft Restoration',
      dealValue: 110000.00,
      dealCurrency: 'AED',
      optedOut: false,
      status: 'new',
      notes: 'Samantha Miller reached out via Instagram DM inquiring about Knotiq raw wool washing techniques.',
      tags: ['usa-market', 'tribeca', 'oversized', 'neutral-palette'],
      dedupeKey: 'lead:tribeca_loft_design_ny',
      lastContactedAt: new Date(`${dMinus1}T16:00:00.000Z`),
      nextFollowUpAt: new Date(Date.now() + 6 * 86400000)
    }
  ];

  await Lead.bulkCreate(leadsInput);
  const allLeads = await Lead.findAll({ where: { userId: USER_ID } });
  const leadMap = new Map();
  allLeads.forEach((l) => leadMap.set(l.businessName, l));

  const mirageLead = leadMap.get('Mirage Hospitality Projects LLC');
  const atelierLead = leadMap.get('Atelier Luxe Living Interior Design');
  const roarLead = leadMap.get('Roar Architecture & Design Studio');
  const summertownLead = leadMap.get('Summertown Interiors & Turnkey Fit-Out');
  const orientalLead = leadMap.get('The Oriental & Modern Carpet Gallery');
  const killaLead = leadMap.get('Killa Design Architectural Consultants');
  const zenLead = leadMap.get('Zen Interiors LLC');
  const kingdomLead = leadMap.get('Kingdom Hospitality Procurement');
  const depaLead = leadMap.get('Depa Interiors LLC');

  // ==========================================
  // 5. Calls Logged (6 Realistic High-Value Logs)
  // ==========================================
  logger.info('5. Seeding Calls...');

  const callsData = [
    {
      userId: USER_ID,
      leadId: mirageLead.id,
      direction: 'outbound',
      calledAt: new Date(`${todayStr}T06:30:00.000Z`), // 10:30 GST
      durationSec: 840, // 14 mins
      outcome: 'connected',
      summary: 'Spoke with Tariq Al-Hashimi regarding 12mm plush cut pile vs 9mm medium pile for high-traffic resort suites. Confirmed fire rating CRI Green Label Plus certification is ready. He requested final quotation submission before 2 PM today.',
      nextAction: 'Email final AED 185,000 formal quotation with CAD strike-off sheets',
      nextFollowUpAt: new Date(`${todayStr}T10:00:00.000Z`),
      createdBy: 'Zishan Ansari'
    },
    {
      userId: USER_ID,
      leadId: atelierLead.id,
      direction: 'inbound',
      calledAt: new Date(`${dMinus1}T10:15:00.000Z`),
      durationSec: 540, // 9 mins
      outcome: 'interested',
      summary: 'Elena Rostova called after receiving the handcrafted Knotiq timber swatch box at Alserkal Avenue. She praised the Champagne and Deep Indigo botanical silk luster. Client loved the abrash finish.',
      nextAction: 'On-site measurement verification at Palm Jumeirah Signature Villa',
      nextFollowUpAt: new Date(`${todayStr}T06:30:00.000Z`),
      createdBy: 'Zishan Ansari'
    },
    {
      userId: USER_ID,
      leadId: roarLead.id,
      direction: 'outbound',
      calledAt: new Date(`${dMinus1}T11:45:00.000Z`),
      durationSec: 360, // 6 mins
      outcome: 'connected',
      summary: 'Spoke with David Henderson regarding DIFC boardroom oversized 6x8m rug. Verified loom width capabilities at our Bhadohi loom facility. Confirmed face-to-face meeting at d3 Building 7 today at 16:30.',
      nextAction: 'Bring physical wool pom-pom box and 1:20 scale CAD sample print to d3 meeting',
      nextFollowUpAt: new Date(`${todayStr}T12:30:00.000Z`),
      createdBy: 'Zishan Ansari'
    },
    {
      userId: USER_ID,
      leadId: summertownLead.id,
      direction: 'outbound',
      calledAt: new Date(`${dMinus2}T09:00:00.000Z`),
      durationSec: 660, // 11 mins
      outcome: 'connected',
      summary: 'Marcus Vance confirmed Bluewaters project timeline. Discussed air cargo transit from Delhi IGI to Dubai DWC (48 hours door-to-door). Reminded him to provide exact CAD floor-box coordinates.',
      nextAction: 'Receive revised CAD drawing with floor cutouts',
      nextFollowUpAt: new Date(`${dMinus1}T10:00:00.000Z`),
      createdBy: 'Zishan Ansari'
    },
    {
      userId: USER_ID,
      leadId: orientalLead.id,
      direction: 'outbound',
      calledAt: new Date(`${dMinus2}T14:30:00.000Z`),
      durationSec: 960, // 16 mins
      outcome: 'interested',
      summary: 'Fatima Al-Mansouri reviewed modern hand-knotted runner collection. Discussed 40% wholesale trade discount terms on a 10-piece initial showroom consignment for Abu Dhabi Corniche gallery.',
      nextAction: 'Send wholesale consignment agreement and high-res runner lookbook',
      nextFollowUpAt: new Date(`${todayStr}T14:00:00.000Z`),
      createdBy: 'Zishan Ansari'
    },
    {
      userId: USER_ID,
      leadId: kingdomLead.id,
      direction: 'outbound',
      calledAt: new Date(`${todayStr}T05:15:00.000Z`),
      durationSec: 480, // 8 mins
      outcome: 'connected',
      summary: 'Introductory discussion with Omar Al-Ghamdi regarding Diriyah Gate heritage hotel project. Clarified Bhadohi loom capacity for 60 room suites. Dispatched DHL express sample crate to Riyadh Olaya office.',
      nextAction: 'Provide DHL tracking number and schedule technical video conference for Thursday',
      nextFollowUpAt: new Date(`${todayStr}T13:00:00.000Z`),
      createdBy: 'Zishan Ansari'
    }
  ];

  await Call.bulkCreate(callsData);

  // ==========================================
  // 5b. Call Scripts (Buyer Type Specific for Knotiq Rugs)
  // ==========================================
  logger.info('5b. Seeding CallScripts...');
  const scriptsData = [
    {
      buyerType: 'designer',
      title: '🎨 Interior Designer & Studio Introduction',
      scriptText: 'Hello [Designer Name], I am calling from Knotiq Rugs. We craft bespoke hand-knotted and hand-tufted New Zealand wool and botanical silk rugs directly from our family loom workshops in Bhadohi, with an executive trade office here in the UAE. We collaborate with premier interior studios across Dubai, Abu Dhabi, and London on luxury villa and penthouse projects with rapid 3-4 week custom strike-off sampling. May I courier our curated 2026 Timber Swatch Box and Trade Portfolio to your studio for your upcoming FF&E specifications?',
      objectionHandling: 'Existing supplier: "We completely respect your current vendor network. Many of our design partners maintain Knotiq as their specialized artisan loom for complex organic shapes, 80-knot hand-wash finishes, and expedited 6-week loom runs without middleman markup."',
      tips: 'Interior designers value fiber grade (semi-worsted NZ wool), strike-off precision, exact Pantone/ARROSO dye matching, and protected trade margins.',
      isDefault: true
    },
    {
      buyerType: 'importer',
      title: '📦 Rug & Carpet Importer / Bulk Wholesale Supply',
      scriptText: 'Good morning [Buyer Name], Knotiq Rugs calling. We are multi-generational loom owners in Bhadohi, India, supplying 20ft and 40ft container shipments of hand-knotted Oushak, modern abrash, and flatweaves directly to regional distributors and importers. By working mill-direct without export intermediaries, we offer competitive FOB Mumbai or CIF Jebel Ali rates with 100% pre-shipment wash inspection. Could we share our wholesale collection catalog and current container price list?',
      objectionHandling: 'Price concerns: "Our direct Bhadohi loom operations provide 25-30% margin enhancement over regional trading houses, backed by SGS certified pile weights and knot counts."',
      tips: 'Lead with knot density (60-knot, 80-knot, 100-knot), FOB/CIF freight terms, packing efficiency, and production turn times.',
      isDefault: false
    },
    {
      buyerType: 'hotel',
      title: '🏨 Hotel & Hospitality FF&E Contract Carpet',
      scriptText: 'Good morning [Procurement Director], this is Knotiq Rugs. We engineer heavy commercial contract-grade hand-tufted wool carpets for 5-star hotels, presidential suites, and high-traffic hospitality public areas. All our carpets satisfy BS EN flame-retardancy and heavy commercial wear standards with full mill-direct certification from our Bhadohi facility. Are you currently reviewing carpet and rug packages for any ongoing resort or hotel fit-outs in the GCC region?',
      objectionHandling: 'Formal tender requirement: "We are fully equipped for vendor registration and tender submittals with AED commercial pricing, compliance datasheets, and laboratory acoustic/fire test certifications."',
      tips: 'Focus on commercial durability, acoustic dampening, loom production capacity, and delivery timetable reliability.',
      isDefault: false
    },
    {
      buyerType: 'retailer',
      title: '🛋️ Luxury Rug & Furniture Retailer Consignment',
      scriptText: 'Hello [Showroom Manager], calling from Knotiq Rugs. We craft exclusive, non-mass-market handmade rug collections featuring organic vegetable dyes and hand-spun New Zealand wool. We offer selected retail partners exclusive territorial designs, display samples, and direct drop-shipping for bespoke customer orders in the UAE. Would you be open to previewing our luxury collection for your showroom floor?',
      objectionHandling: 'Floor space limited: "We support retail partners with compact hanging display racks and high-resolution CAD renderings so your clients can customize dimensions without you having to carry extensive floor stock."',
      tips: 'Emphasize showroom retail markups, design exclusivity, and quick replenishment.',
      isDefault: false
    },
    {
      buyerType: 'online_seller',
      title: '🌐 E-Commerce & Luxury Marketplaces (Amazon / Noon)',
      scriptText: 'Hi [Brand Manager], Knotiq Rugs calling. We provide full private-label OEM manufacturing for curated home decor e-commerce brands, including custom barcode labelling, FBA/Noon compliant flat-pack packaging, and steady batch replenishment with strict QC photos before dispatch. Are you expanding your rug or home textile category this season?',
      objectionHandling: 'High MOQs: "We support emerging luxury digital brands with low minimum trial batches of 10-15 pieces per SKU."',
      tips: 'Discuss packaging compliance, photographic consistency, and inventory replenishment velocity.',
      isDefault: false
    },
    {
      buyerType: 'developer',
      title: '🏗️ Real Estate Developer & Turnkey Fit-Out Partner',
      scriptText: 'Hello [Project Manager], Knotiq Rugs calling. We partner with turnkey fit-out contractors and high-end residential developers across Palm Jumeirah, Emirates Hills, and Dubai Hills to supply custom-measured wool and silk rugs for show villas and handover residences. We handle everything from site laser-measurement to loom production and seamless white-glove installation. What residential projects are approaching flooring handover this quarter?',
      objectionHandling: 'Tight timelines: "We offer an expedited 28-day air-freight loom protocol specifically for show villas and VIP handovers."',
      tips: 'Highlight project timeline coordination, site measurement, and flawless white-glove installation.',
      isDefault: false
    },
    {
      buyerType: 'investor',
      title: '💼 Luxury Holiday Home & Villa Portfolio Carpet Package',
      scriptText: 'Hello [Portfolio Manager], Knotiq Rugs here. We supply high-impact, durable designer wool rugs specifically styled for luxury holiday home operators and Airbnb Luxe penthouses in Downtown and Marina. Our stain-resistant washed wool rugs elevate listing photography and guest booking rates while withstanding repeated professional cleaning. Would you like our standard 2-bedroom and 3-bedroom luxury villa rug packages?',
      objectionHandling: 'Maintenance worries: "Our hand-tufted wool rugs are naturally lanolin-rich and dirt-repellent, lasting 5x longer than synthetic viscose rugs."',
      tips: 'Focus on photographic appeal for booking platforms, durability, and bulk apartment pricing.',
      isDefault: false
    },
    {
      buyerType: 'homeowner',
      title: '🏡 Bespoke Private Residence & Majlis Consultation',
      scriptText: 'Good afternoon, this is Knotiq Rugs. We craft one-of-a-kind bespoke hand-knotted family heirloom rugs, woven by master artisans in Bhadohi to your exact room dimensions and color palette. We bring physical yarn pom-poms and fabric swatches directly to your residence for private in-home lighting evaluation. May we schedule a brief consultation to review your living room or majlis dimensions?',
      objectionHandling: 'Design hesitation: "Our senior carpet designer provides complimentary 3D room visualizer renderings with your furniture layout before a single knot is tied."',
      tips: 'Focus on heirloom craftsmanship, personalized storytelling, and white-glove in-home consultation.',
      isDefault: false
    }
  ];
  await CallScript.bulkCreate(scriptsData);

  // ==========================================
  // 6. FollowUps (Overdue, Today & Upcoming)
  // ==========================================
  logger.info('6. Seeding FollowUps...');

  const followUpsData = [
    {
      userId: USER_ID,
      leadId: summertownLead.id,
      dueAt: new Date(`${dMinus1}T10:00:00.000Z`), // Overdue yesterday (flagged in red)
      channel: 'call',
      step: 'day4',
      status: 'pending',
      notes: 'URGENT: Request updated architectural CAD with exact floor electrical outlet cutouts for Bluewaters Island penthouse.'
    },
    {
      userId: USER_ID,
      leadId: mirageLead.id,
      dueAt: new Date(`${todayStr}T10:00:00.000Z`), // Today
      channel: 'call',
      step: 'day1',
      status: 'pending',
      notes: 'Deliver final AED 185,000 quotation and review payment milestones with Tariq Al-Hashimi before board meeting.'
    },
    {
      userId: USER_ID,
      leadId: atelierLead.id,
      dueAt: new Date(`${todayStr}T12:00:00.000Z`), // Today
      channel: 'whatsapp',
      step: 'day1',
      status: 'pending',
      notes: 'Send WhatsApp photo of finished Palm Jumeirah dye strike-off and confirm signed client approval slip.'
    },
    {
      userId: USER_ID,
      leadId: roarLead.id,
      dueAt: new Date(`${todayStr}T16:00:00.000Z`), // Today
      channel: 'call',
      step: 'custom',
      status: 'pending',
      notes: 'Pre-meeting call with David Henderson before meeting at d3 Building 7.'
    },
    {
      userId: USER_ID,
      leadId: kingdomLead.id,
      dueAt: new Date(Date.now() + 86400000), // Tomorrow
      channel: 'whatsapp',
      step: 'day1',
      status: 'pending',
      notes: 'Share DHL Express airway bill for the Riyadh sample crate and confirm expected delivery date.'
    },
    {
      userId: USER_ID,
      leadId: orientalLead.id,
      dueAt: new Date(Date.now() + 2 * 86400000),
      channel: 'email',
      step: 'day4',
      status: 'pending',
      notes: 'Send formal consignment agreement with 40% margin structure for Abu Dhabi gallery.'
    },
    {
      userId: USER_ID,
      leadId: depaLead.id,
      dueAt: new Date(Date.now() + 3 * 86400000),
      channel: 'call',
      step: 'day7',
      status: 'pending',
      notes: 'Schedule on-site meeting at DIP headquarters with technical wool spec sheets and flammability test results.'
    },
    {
      userId: USER_ID,
      leadId: zenLead.id,
      dueAt: new Date(Date.now() + 7 * 86400000),
      channel: 'whatsapp',
      step: 'custom',
      status: 'pending',
      notes: 'Courtesy satisfaction check-in with Patrick post Emirates Hills installation; ask for high-res staged photography.'
    }
  ];

  await FollowUp.bulkCreate(followUpsData);

  // ==========================================
  // 7. Tasks (MITs & Daily Operations)
  // ==========================================
  logger.info('7. Seeding Tasks...');

  const tasksData = [
    {
      userId: USER_ID,
      title: 'Finalize CAD approval & wool dye strike-offs for Mirage Hospitality 45-rug order',
      description: 'Review warp/weft tension and Pantone 19-4010 TCX color matching for RAK luxury resort suites. Prepare sample dispatch receipt.',
      category: 'production',
      priority: 'high',
      dueAt: noonToday,
      status: 'doing',
      isMIT: true,
      relatedLeadId: mirageLead.id,
      sortOrder: 1
    },
    {
      userId: USER_ID,
      title: 'Dispatch luxury swatch presentation box to Atelier Luxe Living in Alserkal Avenue',
      description: 'Hand-pack Knotiq branded timber box with 80-knot botanical silk and worsted NZ wool samples for Elena Rostova.',
      category: 'sales',
      priority: 'high',
      dueAt: noonToday,
      status: 'todo',
      isMIT: true,
      relatedLeadId: atelierLead.id,
      sortOrder: 2
    },
    {
      userId: USER_ID,
      title: 'Review Loom 4 & Loom 7 weaving progress with Master Weaver Ramesh in Bhadohi via Zoom',
      description: 'Inspect knot density (80 KPSI) and edge binding for oversized 6x8m DIFC investment bank conference rug.',
      category: 'production',
      priority: 'high',
      dueAt: noonToday,
      status: 'todo',
      isMIT: true,
      relatedLeadId: roarLead.id,
      sortOrder: 3
    },
    {
      userId: USER_ID,
      title: 'Prepare commercial export invoice and Certificate of Origin (COO) for Air Cargo batch to Dubai DWC',
      description: 'Include India-UAE CEPA preferential tariff declaration (HSN 57011000) for zero duty import clearance.',
      category: 'shipping',
      priority: 'medium',
      dueAt: noonToday,
      status: 'todo',
      isMIT: false,
      sortOrder: 4
    },
    {
      userId: USER_ID,
      title: 'Follow up on trade terms agreement with Roar Design Studio for DIFC project',
      description: 'Lock in 50% production advance payment schedule and 10-week loom production window.',
      category: 'sales',
      priority: 'high',
      dueAt: noonToday,
      status: 'todo',
      isMIT: false,
      relatedLeadId: roarLead.id,
      sortOrder: 5
    },
    {
      userId: USER_ID,
      title: 'Photograph washed abrash hand-knotted samples for Instagram & LinkedIn case study',
      description: 'Capture natural lighting details showing no shedding and hand-sheared pile texture.',
      category: 'marketing',
      priority: 'medium',
      dueAt: new Date(Date.now() + 86400000),
      status: 'todo',
      isMIT: false,
      sortOrder: 6
    },
    {
      userId: USER_ID,
      title: 'Update wholesale price matrix (AED/sqm) for GCC interior trade program',
      description: 'Incorporate updated New Zealand wool auction prices and revised airfreight surcharges into trade tier rate card.',
      category: 'accounts',
      priority: 'medium',
      dueAt: new Date(Date.now() + 86400000),
      status: 'todo',
      isMIT: false,
      sortOrder: 7
    },
    {
      userId: USER_ID,
      title: 'Audit raw Tibetan & New Zealand wool yarn stock in Bhadohi dye house',
      description: 'Verify 1,200 kg unspun wool reserve to ensure no supply chain bottlenecks for Q1/Q2 hospitality orders.',
      category: 'production',
      priority: 'medium',
      dueAt: new Date(Date.now() + 2 * 86400000),
      status: 'todo',
      isMIT: false,
      sortOrder: 8
    }
  ];

  await Task.bulkCreate(tasksData);
  const allTasks = await Task.findAll({ where: { userId: USER_ID } });
  const taskMap = new Map();
  allTasks.forEach((t) => taskMap.set(t.title, t));

  const mit1Task = taskMap.get(tasksData[0].title);
  const mit2Task = taskMap.get(tasksData[1].title);
  const mit3Task = taskMap.get(tasksData[2].title);

  // ==========================================
  // 8. Rich Business Notes (5 Domain Technical Notes)
  // ==========================================
  logger.info('8. Seeding Notes...');

  const notesData = [
    {
      userId: USER_ID,
      ownerType: 'general',
      ownerId: null,
      title: '2026 GCC Interior Designer Trade Discount Structure & Tiered Volume Rebates',
      body: `Knotiq Rugs Official Trade Program Pricing (AED per square meter):
1. Hand-Knotted 60-Knot (Pure NZ Wool):
   - Standard Trade Price: 1,250 AED/sqm
   - Volume Tier 1 (>50 sqm): 1,050 AED/sqm
   - Volume Tier 2 (>120 sqm): 920 AED/sqm
2. Hand-Knotted 80-Knot (NZ Wool + 20% Botanical Silk):
   - Standard Trade Price: 1,850 AED/sqm
   - Volume Tier 1 (>50 sqm): 1,550 AED/sqm
   - Volume Tier 2 (>120 sqm): 1,380 AED/sqm
3. Hand-Tufted Luxury Cut Pile (100% NZ Wool, 12mm):
   - Standard Trade Price: 750 AED/sqm
   - Volume Tier 1 (>100 sqm): 590 AED/sqm

Commercial Terms:
- Advance: 50% upon CAD sign-off and strike-off approval.
- Balance: 50% prior to dispatch from Dubai DWC customs bonded warehouse.
- Trade Swatch Kit: Complimentary for designers with >1 active project.`,
      tags: ['trade-pricing', 'discounts', 'aed-matrix', 'terms'],
      pinned: true
    },
    {
      userId: USER_ID,
      ownerType: 'general',
      ownerId: null,
      title: 'Wool Blends & Botanical Silk Technical Specifications for Hospitality Projects',
      body: `Technical Specifications for High-Traffic Hospitality and Commercial Suites:
- Pile Fiber: 80% First-Shear New Zealand Worsted Wool (28-32 micron, high crimp for resilience) + 20% Bamboo Silk / Tencel (high luster, zero linting).
- Warp & Weft: 100% 3-ply high-twist unbleached cotton base for dimensional stability.
- Pile Weight: 3,200 grams/sqm (approx. 95 oz/sqyd).
- Total Thickness: 12.0 mm (+/- 0.5 mm).
- Fire Retardancy: Meets ASTM E648 Class 1 Critical Radiant Flux and BS 4790 (Hot Metal Nut Test). Low smoke emission.
- Anti-Microbial & Anti-Moth: Permethrin-treated in accordance with international wool standards; zero odor.
- LEED Compliance: Low-emitting materials; zero VOC latex backing on hand-tufted variants.`,
      tags: ['technical-spec', 'nz-wool', 'fire-rating', 'hospitality'],
      pinned: true
    },
    {
      userId: USER_ID,
      ownerType: 'general',
      ownerId: null,
      title: 'Bhadohi to UAE Air Freight Protocol & Customs Clearance at Dubai DWC',
      body: `Logistics Workflow:
1. Production Packing at Bhadohi Workshop:
   - Primary Wrap: Heavy-duty 250-gauge moisture-proof polyethylene film with silica gel desiccants.
   - Secondary Outer: High-density woven jute hessian stitched with tamper-evident seal.
2. Inland Transport:
   - Bhadohi Loom Workshop -> Varanasi / Lucknow Airport or direct bonded truck to Delhi IGI Airport (Air Cargo Complex).
3. Airfreight Route:
   - Carrier: Emirates SkyCargo / Flydubai Cargo (Direct DEL -> DWC / DXB).
   - Flight duration: 3h 45m.
4. UAE Customs Documentation:
   - HSN Code: 57011000 (Carpets & other textile floor coverings, knotted, of wool).
   - India-UAE CEPA Certificate of Origin (COO): Provides 0% preferential duty into UAE.
   - Commercial Invoice & Packing List attested by Bhadohi Carpet Export Promotion Council (CEPC).`,
      tags: ['logistics', 'air-freight', 'customs', 'dwc-dubai', 'cepa'],
      pinned: false
    },
    {
      userId: USER_ID,
      ownerType: 'lead',
      ownerId: String(mirageLead.id),
      title: 'Mirage Hospitality RAK Suite Specs & Pantone Color Swatches',
      body: `Client: Mirage Hospitality Projects LLC
Project: Five-Star Beachfront Resort, Ras Al Khaimah (45 Suites)
Approved Pantone Palette:
- Primary Field: Pantone 19-4010 TCX (Total Eclipse Indigo)
- Secondary Accent: Pantone 14-1116 TCX (Almond Buff)
- Highlight Veins: Pantone 16-1325 TCX (Copper Tan Botanical Silk)
Pile Type: Hand-Knotted 80-Knot, 11mm cut pile with hand-carved relief contours.
Delivery Phasing:
- Phase 1: 15 Suites by April 2026
- Phase 2: 30 Suites by June 2026`,
      tags: ['mirage', 'pantone', 'rak-resort', 'color-matching'],
      pinned: false
    },
    {
      userId: USER_ID,
      ownerType: 'lead',
      ownerId: String(atelierLead.id),
      title: 'Elena Rostova Signature Villa Preferences & Client Aesthetic',
      body: `Client Profile: Atelier Luxe Living (Elena Rostova)
Style: Organic modern minimalism, Japandi luxury, neutral earthy palettes.
Preferred Weaves: Hand-knotted Tibetan weave with low shear, washed abrash finish to mimic stone patina.
Dislikes: Heavy synthetic shine, rigid geometric borders, visible fringes (prefers blind-stitched hemmed selvedge).
Pricing Expectation: Willing to pay top dollar (1,600 - 2,000 AED/sqm) provided loom time is guaranteed under 8 weeks.`,
      tags: ['atelier-luxe', 'designer-profile', 'japandi', 'palm-jumeirah'],
      pinned: false
    }
  ];

  await Note.bulkCreate(notesData);

  // ==========================================
  // 9. Calendar Events (Today & Tomorrow)
  // ==========================================
  logger.info('9. Seeding CalendarEvents...');

  const calendarEventsData = [
    {
      userId: USER_ID,
      title: 'Palm Jumeirah Signature Villa On-Site Rug Measurement & Lighting Check',
      startAt: new Date(`${todayStr}T06:30:00.000Z`), // 10:30 GST
      endAt: new Date(`${todayStr}T07:30:00.000Z`), // 11:30 GST
      type: 'meeting',
      relatedLeadId: atelierLead.id,
      location: 'Frond N, Palm Jumeirah, Dubai',
      notes: 'Meeting Elena Rostova and client on-site. Measure living room fireplace recess and check afternoon natural sunlight exposure on botanical silk samples.',
      allDay: false
    },
    {
      userId: USER_ID,
      title: 'Zoom Factory Inspection: Loom 4 & 7 Weaving Milestone with Ramesh (Bhadohi)',
      startAt: new Date(`${todayStr}T10:00:00.000Z`), // 14:00 GST / 15:30 IST
      endAt: new Date(`${todayStr}T10:45:00.000Z`), // 14:45 GST
      type: 'production',
      relatedLeadId: roarLead.id,
      location: 'Zoom Video Call / Bhadohi Loom Workshop',
      notes: 'Live loom inspection of 6x8m conference carpet. Inspect warp tension, double-knotting accuracy, and hand-shearing finish.',
      allDay: false
    },
    {
      userId: USER_ID,
      title: 'D3 Design Presentation: Bespoke Rug Swatches with Roar Architecture Team',
      startAt: new Date(`${todayStr}T12:30:00.000Z`), // 16:30 GST
      endAt: new Date(`${todayStr}T13:30:00.000Z`), // 17:30 GST
      type: 'meeting',
      relatedLeadId: roarLead.id,
      location: 'Building 7, Dubai Design District (d3), Dubai',
      notes: 'Present luxury wool pom-poms, acoustic backing strike-offs, and final quotation to David Henderson and commercial team.',
      allDay: false
    },
    {
      userId: USER_ID,
      title: 'Trade Agreement Review with Summertown Fitout',
      startAt: new Date(`${daysAgoStr(-1)}T07:00:00.000Z`), // Tomorrow 11:00 GST
      endAt: new Date(`${daysAgoStr(-1)}T08:00:00.000Z`),
      type: 'call_block',
      relatedLeadId: summertownLead.id,
      location: 'Google Meet / Knotiq Commercial Hub Ajman',
      notes: 'Go over trade contractor discount terms, LEED documentation delivery, and delivery milestones for Bluewaters project.',
      allDay: false
    }
  ];

  await CalendarEvent.bulkCreate(calendarEventsData);

  // ==========================================
  // 10. Daily Plan & Daily Review (Today & Consecutive Days)
  // ==========================================
  logger.info('10. Seeding DailyPlan & DailyReviews...');

  // Today's Daily Plan
  await DailyPlan.create({
    userId: USER_ID,
    date: todayStr,
    mit1: mit1Task.title,
    mit2: mit2Task.title,
    mit3: mit3Task.title,
    mit1TaskId: mit1Task.id,
    mit2TaskId: mit2Task.id,
    mit3TaskId: mit3Task.id,
    outreachTarget: 30,
    callTarget: 20,
    morningNote: 'Loom productivity at Bhadohi is steady. Focus today is closing the Mirage Hospitality order and locking down the sample approval for Atelier Luxe Living.'
  });

  // Daily Reviews for consecutive streak (5 days)
  const reviewsData = [
    {
      userId: USER_ID,
      date: dMinus4,
      doneSummary: 'Conducted 21 calls, sent 30 emails and 32 WhatsApps. Cleared custom clearances at DWC for Zen Interiors rug batch.',
      win: 'Zen Interiors verified delivery and client was thrilled with zero shedding.',
      lesson: 'Always send digital packing photos prior to airfreight loading.',
      tomorrowNotes: 'Prepare Roar Architecture pitch proposal.',
      completedAt: new Date(`${dMinus4}T15:30:00.000Z`)
    },
    {
      userId: USER_ID,
      date: dMinus3,
      doneSummary: 'Conducted 23 calls, sent 34 emails and 30 WhatsApps. Completed factory video inspection with Master Weaver Ramesh.',
      win: 'Locked in Loom 4 and Loom 7 capacity exclusively for oversized rugs.',
      lesson: 'Double check dye bath temperature consistency for deep indigo hues.',
      tomorrowNotes: 'Follow up on Summertown JAFZA project measurements.',
      completedAt: new Date(`${dMinus3}T15:45:00.000Z`)
    },
    {
      userId: USER_ID,
      date: dMinus2,
      doneSummary: 'Conducted 20 calls, sent 31 emails and 28 WhatsApps. Pitched Fatima at Oriental Carpet Gallery Abu Dhabi.',
      win: 'Agreed in principle to a 10-piece luxury showroom consignment in Abu Dhabi.',
      lesson: 'Showroom owners need high-resolution marketing display assets.',
      tomorrowNotes: 'Courier timber presentation box to Atelier Luxe Living.',
      completedAt: new Date(`${dMinus2}T16:00:00.000Z`)
    },
    {
      userId: USER_ID,
      date: dMinus1,
      doneSummary: 'Conducted 22 calls, sent 32 emails and 28 WhatsApps. Elena at Atelier Luxe Living confirmed swatch box receipt and approved botanical silk colors.',
      win: 'Closed 78,000 AED residential deal and initiated Mirage 185k AED quotation.',
      lesson: 'Physical wool pom-poms with timber boxes convert 3x faster than digital PDFs.',
      tomorrowNotes: 'Execute D3 meeting with Roar Architecture and finalize Mirage RFP.',
      completedAt: new Date(`${dMinus1}T16:15:00.000Z`)
    },
    {
      userId: USER_ID,
      date: todayStr,
      doneSummary: 'Conducted 20 sales calls, dispatched 30 emails and 30 WhatsApps. Attended Palm Jumeirah villa measurement with Elena Rostova.',
      win: 'Mirage Hospitality procurement board approved Knotiq as preferred rug vendor for RAK 45-suite project.',
      lesson: 'Keep CEPA origin certificates ready before client commercial review.',
      tomorrowNotes: 'Review contract signing with Roar Architecture and track DHL dispatch to Riyadh.',
      completedAt: new Date(`${todayStr}T15:00:00.000Z`)
    }
  ];

  await DailyReview.bulkCreate(reviewsData);

  // ==========================================
  // 11. Outreach Logs (Active Daily Target Progress & Streaks)
  // ==========================================
  logger.info('11. Seeding OutreachLogs...');

  const outreachLogs = [];

  // Seed 35 outreach logs for each of the last 4 days (so targetStreak = 5)
  const pastDays = [dMinus4, dMinus3, dMinus2, dMinus1];
  for (const day of pastDays) {
    for (let j = 1; j <= 20; j++) {
      const targetLead = allLeads[j % allLeads.length];
      outreachLogs.push({
        userId: USER_ID,
        leadId: targetLead.id,
        channel: 'email',
        step: 'day1',
        variant: j % 2 === 0 ? 'B' : 'A',
        messageSent: `Subject: Bespoke Hand-Knotted Rugs from Bhadohi Looms | Knotiq Rugs UAE\n\nDear Partner,\n\nWe would be honored to provide direct loom-to-studio trade pricing for your ongoing luxury projects.`,
        sentAt: new Date(`${day}T06:${String(10 + (j % 50)).padStart(2, '0')}:00.000Z`),
        outcome: j % 3 === 0 ? 'read' : 'delivered',
        recipient: targetLead.email || `designer_${j}@interiorfirm-uae.com`
      });
    }
    for (let k = 1; k <= 15; k++) {
      const targetLead = allLeads[(k + 2) % allLeads.length];
      outreachLogs.push({
        userId: USER_ID,
        leadId: targetLead.id,
        channel: 'whatsapp',
        step: 'day1',
        variant: 'A',
        messageSent: `Hello! This is Zishan from Knotiq Rugs. We craft bespoke hand-knotted New Zealand wool rugs directly from our heritage looms in Bhadohi. May we dispatch our curated swatch box to your studio?`,
        sentAt: new Date(`${day}T08:${String(15 + (k % 40)).padStart(2, '0')}:00.000Z`),
        outcome: 'delivered',
        recipient: targetLead.whatsapp || `+97150${String(1000000 + k)}`
      });
    }
  }

  // Seed 35 outreach logs for TODAY (20 emails + 15 WhatsApps) to show target achieved today
  for (let j = 1; j <= 20; j++) {
    const targetLead = allLeads[j % allLeads.length];
    outreachLogs.push({
      userId: USER_ID,
      leadId: targetLead.id,
      channel: 'email',
      step: 'day1',
      variant: j % 2 === 0 ? 'B' : 'A',
      messageSent: `Subject: Knotiq Rugs Architectural Specifier Portfolio (Dubai / Bhadohi)\n\nGood morning,\n\nFollowing up on our luxury trade program. Our artisan looms in Bhadohi specialize in custom 60-100 knot density rugs with 0% import duty under CEPA.`,
      sentAt: new Date(`${todayStr}T05:${String(10 + (j % 50)).padStart(2, '0')}:00.000Z`),
      outcome: j % 2 === 0 ? 'read' : 'sent',
      recipient: targetLead.email || `trade_contact_${j}@uae-design.com`
    });
  }

  for (let k = 1; k <= 15; k++) {
    const targetLead = allLeads[(k + 3) % allLeads.length];
    outreachLogs.push({
      userId: USER_ID,
      leadId: targetLead.id,
      channel: 'whatsapp',
      step: 'day1',
      variant: 'A',
      messageSent: `Salam! Zishan from Knotiq Rugs. Sharing our newly updated 2026 Wool & Botanical Silk lookbook for luxury villas and hospitality suites in the UAE. Let me know if you would like physical strike-off pom-poms sent to your office.`,
      sentAt: new Date(`${todayStr}T07:${String(10 + (k % 40)).padStart(2, '0')}:00.000Z`),
      outcome: 'delivered',
      recipient: targetLead.whatsapp || `+97152${String(2000000 + k)}`
    });
  }

  await OutreachLog.bulkCreate(outreachLogs);

  // ==========================================
  // 12. Marketing Campaigns & Outreach Templates
  // ==========================================
  logger.info('12. Seeding Campaigns & OutreachTemplates...');

  // Templates
  const templatesData = [
    {
      userId: USER_ID,
      name: 'Hospitality Procurement Initial Intro (Email)',
      targetLeadType: 'Hospitality Procurement & Fit-Out',
      buyerType: 'hospitality',
      step: 'day1',
      variant: 'A',
      channel: 'email',
      subject: 'Direct Loom Sourcing: Bespoke Hand-Knotted Rugs for {{businessName}}',
      body: `Dear Procurement Team at {{businessName}},\n\nKnotiq Rugs operates direct artisan looms in Bhadohi, India with our executive commercial office in Ajman / Dubai. We specialize in bespoke hand-knotted and hand-tufted carpets engineered for luxury hotels, resorts, and palatial residences.\n\nKey Highlights for {{city}} Projects:\n- 100% New Zealand Wool & Botanical Silk blends\n- Fire-rated CRI Green Label Plus certification\n- Zero import duty into UAE via CEPA preferential trade agreement\n- Turnaround: 48-hour CAD strike-off approvals\n\nMay we dispatch a complimentary luxury timber swatch box to your {{city}} office this week?\n\nWarm regards,\nZishan Ansari\nFounder & Commercial Director | Knotiq Rugs\nDubai / Bhadohi`,
      variables: ['businessName', 'city'],
      isDefault: true,
      isActive: true
    },
    {
      userId: USER_ID,
      name: 'Hospitality Procurement Value Proposition (Email - Challenger B)',
      targetLeadType: 'Hospitality Procurement & Fit-Out',
      buyerType: 'hospitality',
      step: 'day1',
      variant: 'B',
      channel: 'email',
      subject: 'Eliminate Middlemen Markups on Luxury Rug Packages for {{businessName}}',
      body: `Hi {{businessName}} Team,\n\nTired of 30-40% markup from distributor intermediaries on custom hospitality rugs?\n\nKnotiq Rugs connects your design and procurement team directly with our master loom workshops in Bhadohi. From 60 to 100 knot densities to oversized 8-meter single-piece seamless weaves, we deliver uncompromised luxury directly to {{city}} site.\n\nLet us submit an alternate proposal on your current FF&E tender to demonstrate our 25% cost efficiency.\n\nSincerely,\nZishan Ansari\nKnotiq Rugs`,
      variables: ['businessName', 'city'],
      isDefault: false,
      isActive: true
    },
    {
      userId: USER_ID,
      name: 'Luxury Interior Designer Swatch Box Offer (WhatsApp)',
      targetLeadType: 'High-End Residential Interior Designer',
      buyerType: 'interior_designer',
      step: 'day1',
      variant: 'A',
      channel: 'whatsapp',
      subject: null,
      body: `Hello from Knotiq Rugs! We noticed your stunning residential portfolio in {{city}}. We craft bespoke hand-knotted rugs for luxury villas (featuring New Zealand wool and washed abrash finishes). We would love to deliver our handcrafted wooden swatch box with 24 pom-poms directly to {{businessName}}. May we drop it off this week?`,
      variables: ['businessName', 'city'],
      isDefault: true,
      isActive: true
    }
  ];

  const createdTemplates = await OutreachTemplate.bulkCreate(templatesData);

  // Campaigns
  const campaignsData = [
    {
      userId: USER_ID,
      name: 'GCC Luxury Hospitality Trade Program Q1 2026',
      goal: 'Secure 5 luxury hotel & resort FF&E carpet specifications across UAE and Saudi Arabia',
      channel: 'email',
      targetBuyerType: 'hospitality',
      startDate: todayStr,
      endDate: '2026-06-30',
      status: 'active',
      budget: 15000.00,
      currency: 'AED',
      notes: 'Targeting hotel procurement directors, FF&E consultants, and resort architects in Dubai, Ras Al Khaimah, and Riyadh.'
    },
    {
      userId: USER_ID,
      name: 'Private Villa Interior Designers - Swatch Box Infiltration',
      goal: 'Deliver 30 curated physical timber swatch boxes to premier design studios in Alserkal Avenue, d3, and Jumeirah',
      channel: 'whatsapp',
      targetBuyerType: 'interior_designer',
      startDate: dMinus4,
      endDate: '2026-04-30',
      status: 'active',
      budget: 8500.00,
      currency: 'AED',
      notes: 'Converting luxury residential interior studios with physical wool pom-poms and strike-off samples.'
    }
  ];

  await Campaign.bulkCreate(campaignsData);
  const allCampaigns = await Campaign.findAll({ where: { userId: USER_ID } });
  const campMap = new Map();
  allCampaigns.forEach((c) => campMap.set(c.name, c));
  const camp1 = campMap.get(campaignsData[0].name);
  const camp2 = campMap.get(campaignsData[1].name);

  // Campaign Leads
  await CampaignLead.bulkCreate([
    { userId: USER_ID, campaignId: camp1.id, leadId: mirageLead.id },
    { userId: USER_ID, campaignId: camp1.id, leadId: kingdomLead.id },
    { userId: USER_ID, campaignId: camp1.id, leadId: depaLead.id },
    { userId: USER_ID, campaignId: camp2.id, leadId: atelierLead.id },
    { userId: USER_ID, campaignId: camp2.id, leadId: roarLead.id },
    { userId: USER_ID, campaignId: camp2.id, leadId: killaLead.id }
  ]);

  // ==========================================
  // 13. Content Calendar Posts
  // ==========================================
  logger.info('13. Seeding ContentPosts...');

  const postsData = [
    {
      userId: USER_ID,
      platform: 'instagram',
      scheduledAt: new Date(`${dMinus2}T07:00:00.000Z`),
      topic: 'The Rhythm of the Loom: Master Weaver Ramesh Hand-Knotting in Bhadohi',
      caption: 'Every single knot in a Knotiq rug is tied by hand with generational mastery. Watch Master Weaver Ramesh precision-knotting 80 knots per square inch in our Bhadohi heritage workshop. Pure New Zealand worsted wool meets ancestral artistry. Bespoke commissions available for UAE & GCC designers.',
      hashtags: '#KnotiqRugs #HandKnotted #BhadohiArtisans #BespokeRugs #DubaiInteriorDesign #LuxuryLiving #ArtisanCraft #CraftsmanshipMatters',
      assetLink: 'https://cdn.knotiqrugs.com/media/ig_reel_bhadohi_loom_ramesh.mp4',
      status: 'posted',
      campaignId: camp2.id,
      postedUrl: 'https://instagram.com/p/DFknotiq01',
      postedAt: new Date(`${dMinus2}T07:15:00.000Z`),
      impressions: 4820,
      likes: 388,
      comments: 26,
      saves: 54,
      clicks: 82,
      leadsGenerated: 3
    },
    {
      userId: USER_ID,
      platform: 'linkedin',
      scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
      topic: 'Specifying Commercial Flooring: Why 100% New Zealand Wool Outperforms Synthetics in Luxury Hospitality',
      caption: 'When designing 5-star hotel suites and high-traffic VIP lounges, flooring durability and aesthetic longevity are paramount. Here is why leading architectural studios are pivoting back to 100% New Zealand worsted wool:\n\n1. Natural Elasticity & Pile Recovery: Wool fibers have a natural coil that resists permanent crushing under heavy furniture.\n2. Inherent Flame Resistance: Meets ASTM E648 Class 1 and British Standards naturally without toxic chemical retardants.\n3. Air Purification: Wool actively absorbs and locks away indoor air contaminants (formaldehyde and SO2).\n\nAt Knotiq Rugs, our direct loom-to-specifier model eliminates commercial markups while offering custom strike-off matching in 48 hours.\n\nDM or email us at trade@knotiqrugs.com for our 2026 Hospitality Specifier Compendium.',
      hashtags: '#HospitalityDesign #FFEProcurement #InteriorArchitecture #LuxuryHotels #KnotiqRugs #HotelFitout #DubaiDesign',
      assetLink: 'https://cdn.knotiqrugs.com/media/linkedin_carousel_nz_wool_hospitality.pdf',
      status: 'scheduled',
      campaignId: camp1.id
    },
    {
      userId: USER_ID,
      platform: 'pinterest',
      scheduledAt: new Date(`${dMinus3}T09:00:00.000Z`),
      topic: 'Minimalist Neutral Rugs: Washed Abrash & Botanical Silk Accents for Palm Jumeirah Villas',
      caption: 'Warm earthy neutrals, organic hand-sheared textures, and subtle abrash color variations. Discover how Knotiq Rugs creates serene, grounding centerpieces for private beachfront villas and penthouses across Dubai and Abu Dhabi.',
      hashtags: '#PalmJumeirahLiving #LuxuryVillas #OrganicModern #MinimalistRug #JapandiDesign #CustomCarpet #KnotiqRugs',
      assetLink: 'https://cdn.knotiqrugs.com/media/pinterest_palm_villa_neutral_collection.jpg',
      status: 'posted',
      campaignId: camp2.id,
      postedUrl: 'https://pinterest.com/pin/981240189218',
      postedAt: new Date(`${dMinus3}T09:10:00.000Z`),
      impressions: 2950,
      likes: 142,
      comments: 8,
      saves: 118,
      clicks: 164,
      leadsGenerated: 2
    },
    {
      userId: USER_ID,
      platform: 'newsletter',
      scheduledAt: new Date(Date.now() + 3 * 86400000),
      topic: 'Behind the Loom: How Custom Pantone Strike-Offs are Hand-Dyed in 48 Hours',
      caption: 'An exclusive look inside our Bhadohi dye laboratory. Explore our artisanal pot-dyeing process using eco-safe Swiss pigments to achieve exact color fidelity for interior design CAD elevations.',
      hashtags: '#BehindTheScenes #HandDyedWool #ColorMastery #ArtisanTextiles',
      assetLink: 'https://cdn.knotiqrugs.com/media/newsletter_dye_lab_bhadohi.jpg',
      status: 'draft',
      campaignId: camp2.id
    }
  ];

  await ContentPost.bulkCreate(postsData);

  // ==========================================
  // 14. Strategic Mindmap & Nodes (Revenue Engine)
  // ==========================================
  logger.info('14. Seeding Mindmap & Nodes...');

  const mindmap = await Mindmap.create({
    userId: USER_ID,
    title: 'Knotiq Rugs 2026 Sovereign Growth: 500,000 AED Monthly Revenue & 40 Active Trade Accounts',
    description: 'Comprehensive business expansion blueprint uniting Bhadohi artisan heritage looms with UAE & GCC luxury interior designer procurement networks.',
    goalText: 'Scale recurring B2B trade partnerships across hospitality, residential interior designers, and turnkey fit-out leaders to reach 500k AED monthly baseline.',
    targetValue: 500000.00,
    targetUnit: 'AED/month',
    deadline: new Date('2026-12-31T23:59:59.000Z'),
    status: 'active',
    layoutPref: 'radial'
  });

  // Root Node
  const rootNode = await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: null,
    title: '2026 Revenue Milestone: 500,000 AED / Month',
    summary: 'The central growth driver: 40 active trade designer accounts, 5 high-ticket hospitality contracts, and an unbroken direct loom supply chain.',
    why: 'Direct loom-to-designer control eliminates middlemen markups and guarantees unmatched margin and artisan dignity.',
    how: 'Execute daily outreach (20 calls, 30 emails, 30 WhatsApps), deliver physical swatch boxes in under 24 hours, and maintain 48-hour CAD strike-off approvals.',
    startDate: startOfToday,
    dueDate: new Date('2026-12-31T23:59:59.000Z'),
    owner: 'Zishan Ansari',
    kpiLabel: 'Monthly Revenue (AED)',
    kpiTarget: 500000.00,
    kpiCurrent: 185000.00,
    priority: 'now',
    status: 'doing',
    color: '#F59E0B',
    icon: 'target',
    tags: ['revenue', 'core-goal', '2026-vision'],
    sortOrder: 0
  });

  // Branch 1: Hospitality FF&E Pipeline
  const branch1 = await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: rootNode.id,
    title: 'Hospitality FF&E Contract Pipeline',
    summary: 'Targeting 5-star hotels, luxury boutique resorts, and branded residences in Dubai, Ras Al Khaimah, and Riyadh.',
    why: 'Hospitality orders generate massive volume (30-80 rugs per order) and long-term brand prestige.',
    how: 'Pitch procurement directors with CRI Green Label fire certifications, CEPA zero-duty documentation, and competitive AED/sqm rate cards.',
    startDate: startOfToday,
    dueDate: new Date('2026-06-30T23:59:59.000Z'),
    owner: 'Zishan Ansari',
    kpiLabel: 'Signed Hospitality Contracts',
    kpiTarget: 5.00,
    kpiCurrent: 1.00,
    priority: 'now',
    status: 'doing',
    color: '#10B981',
    icon: 'hotel',
    tags: ['hospitality', 'contract', 'volume'],
    linkedCampaignId: camp1.id,
    linkedLeadId: mirageLead.id,
    linkedTaskId: mit1Task.id,
    sortOrder: 1
  });

  // Branch 2: High-End Interior Designer Trade Program
  const branch2 = await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: rootNode.id,
    title: 'Interior Designer Trade Ambassador Program',
    summary: 'Building high-touch partnerships with 40 luxury residential interior designers in Alserkal Avenue, d3, and Jumeirah.',
    why: 'Interior designers offer steady, monthly villa commissions with high margins (1,500 - 2,200 AED/sqm) and zero tender bureaucracy.',
    how: 'Infiltrate studios with handcrafted wooden swatch boxes, offer 48-hour custom CAD strike-offs, and provide 10% designer trade commissions.',
    startDate: startOfToday,
    dueDate: new Date('2026-08-31T23:59:59.000Z'),
    owner: 'Zishan Ansari',
    kpiLabel: 'Active Trade Accounts',
    kpiTarget: 40.00,
    kpiCurrent: 14.00,
    priority: 'now',
    status: 'doing',
    color: '#3B82F6',
    icon: 'palette',
    tags: ['interior-designers', 'trade-program', 'swatch-box'],
    linkedCampaignId: camp2.id,
    linkedLeadId: atelierLead.id,
    linkedTaskId: mit2Task.id,
    sortOrder: 2
  });

  // Branch 3: Bhadohi Loom Mastery & Logistics Control
  const branch3 = await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: rootNode.id,
    title: 'Bhadohi Loom Workshop & Airfreight Logistics',
    summary: 'Scaling loom capacity to 16 active looms and streamlining 48-hour airfreight clearance into Dubai DWC.',
    why: 'Flawless production speed, zero yarn shedding, and predictable transit times are our fundamental competitive moats.',
    how: 'Keep 1,200kg of pre-spun New Zealand wool in dye reserves, conduct weekly Zoom inspections with Master Weaver Ramesh, and utilize CEPA preferential tariff.',
    startDate: startOfToday,
    dueDate: new Date('2026-10-31T23:59:59.000Z'),
    owner: 'Zishan Ansari',
    kpiLabel: 'Active Looms',
    kpiTarget: 16.00,
    kpiCurrent: 9.00,
    priority: 'next',
    status: 'doing',
    color: '#8B5CF6',
    icon: 'tool',
    tags: ['bhadohi-looms', 'production', 'air-freight', 'quality-control'],
    linkedTaskId: mit3Task.id,
    sortOrder: 3
  });

  // Leaf 1.1: Mirage Hospitality Beachfront Resort
  await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: branch1.id,
    title: 'Mirage Hospitality RAK 45-Suite Order (AED 185k)',
    summary: 'Close formal quotation and initiate 50% advance production schedule for 45 hand-knotted resort suites.',
    why: 'Anchors Q1 revenue and positions Knotiq as the premier resort carpet manufacturer in the Northern Emirates.',
    how: 'Submit final CAD elevation sheets and fire lab certificates today.',
    startDate: startOfToday,
    dueDate: new Date(Date.now() + 2 * 86400000), // Due this week!
    owner: 'Zishan Ansari',
    kpiLabel: 'Contract Value (AED)',
    kpiTarget: 185000.00,
    kpiCurrent: 185000.00,
    priority: 'now',
    status: 'todo',
    color: '#10B981',
    icon: 'award',
    tags: ['mirage', 'rfp', 'urgent'],
    linkedLeadId: mirageLead.id,
    linkedTaskId: mit1Task.id,
    sortOrder: 1
  });

  // Leaf 2.1: Alserkal Avenue & d3 Swatch Infiltration
  await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: branch2.id,
    title: 'Alserkal Avenue & d3 Design District Swatch Drop',
    summary: 'Deliver 15 presentation boxes to Elena Rostova, Roar Design, Killa Design, and top boutique studios.',
    why: 'Designers specify rugs only when they can touch, feel, and review yarn luster under real room lighting.',
    how: 'Personal in-person drops with curated wool pom-poms and strike-off cuttings.',
    startDate: startOfToday,
    dueDate: new Date(Date.now() + 4 * 86400000), // Due this week!
    owner: 'Zishan Ansari',
    kpiLabel: 'Boxes Delivered',
    kpiTarget: 15.00,
    kpiCurrent: 8.00,
    priority: 'now',
    status: 'doing',
    color: '#3B82F6',
    icon: 'package',
    tags: ['swatch-box', 'alserkal', 'd3'],
    linkedLeadId: atelierLead.id,
    linkedTaskId: mit2Task.id,
    sortOrder: 2
  });

  // Leaf 3.1: Loom 4-8 Dedicated Oversized Weaving
  await MindmapNode.create({
    userId: USER_ID,
    mindmapId: mindmap.id,
    parentId: branch3.id,
    title: 'Dedicate Looms 4-8 for Seamless Oversized Rugs (>6m)',
    summary: 'Maintain 4 heavy-duty wide looms exclusively for palace and commercial boardroom seamless weaves.',
    why: 'Middle East luxury villas and executive boardrooms demand seamless carpets exceeding standard 4m widths.',
    how: 'Retain master loom technicians in Bhadohi and pre-tension extra-heavy cotton warp frames.',
    startDate: startOfToday,
    dueDate: new Date(Date.now() + 5 * 86400000),
    owner: 'Master Weaver Ramesh',
    kpiLabel: 'Oversized Looms Online',
    kpiTarget: 4.00,
    kpiCurrent: 2.00,
    priority: 'next',
    status: 'doing',
    color: '#8B5CF6',
    icon: 'maximize',
    tags: ['looms', 'oversized', 'bhadohi'],
    linkedTaskId: mit3Task.id,
    sortOrder: 3
  });

  // Update Task cross-links to Mindmap nodes
  await mit1Task.update({ relatedMindmapNodeId: branch1.id });
  await mit2Task.update({ relatedMindmapNodeId: branch2.id });
  await mit3Task.update({ relatedMindmapNodeId: branch3.id });

  // ==========================================
  // 15. Search Presets, Schedules & OptOuts
  // ==========================================
  logger.info('15. Seeding SearchPresets, Schedules & OptOuts...');
  await OptOut.destroy({ where: {} });

  await SearchPreset.bulkCreate([
    {
      userId: USER_ID,
      name: 'Dubai Luxury Interior Designers & Fit-Out Specialists',
      leadTypes: ['High-End Residential Interior Designer', 'Turnkey Fit-Out Contractor', 'Commercial Architect & Workplace Specifier'],
      country: 'United Arab Emirates',
      state: 'Dubai',
      city: 'Dubai',
      customKeyword: 'luxury interior design bespoke rugs villa fit out',
      minRating: 4.5,
      minReviews: 10,
      hasWebsite: true,
      hasEmail: true,
      hasPhone: true,
      hasWhatsapp: true,
      minScore: 70
    },
    {
      userId: USER_ID,
      name: 'Abu Dhabi & Riyadh Hospitality Procurement',
      leadTypes: ['Hospitality Procurement & Fit-Out', 'Luxury Flooring Retailer'],
      country: 'United Arab Emirates',
      state: 'Abu Dhabi',
      city: 'Abu Dhabi',
      customKeyword: 'hospitality procurement hotel carpet ff&e rugs',
      minRating: 4.0,
      minReviews: 5,
      hasWebsite: true,
      hasEmail: true,
      hasPhone: true,
      hasWhatsapp: false,
      minScore: 65
    }
  ]);

  await Schedule.create({
    userId: USER_ID,
    name: 'Weekly Dubai Design District & Alserkal Lead Discovery Scan',
    cronExpression: '0 9 * * 1', // Every Monday at 9:00 AM
    leadTypes: ['High-End Residential Interior Designer', 'Commercial Architect & Workplace Specifier'],
    country: 'United Arab Emirates',
    state: 'Dubai',
    city: 'Dubai',
    enabled: true,
    lastRunAt: new Date(`${dMinus4}T05:00:00.000Z`),
    nextRunAt: new Date(Date.now() + 3 * 86400000),
    lastStatus: 'completed'
  });

  await OptOut.bulkCreate([
    {
      type: 'email',
      value: 'unsubscribe-test@fakeagency.com',
      reason: 'Automated test suppression request',
      requestedAt: new Date(`${dMinus4}T08:00:00.000Z`)
    },
    {
      type: 'domain',
      value: 'lowend-carpets-generic.com',
      reason: 'Competitor bulk carpet broker; excluded from high-end trade outreach',
      requestedAt: new Date(`${dMinus2}T12:00:00.000Z`)
    }
  ]);

  // Log audit event
  await AuditLog.create({
    userId: USER_ID,
    entityType: 'system_seed',
    entityId: 'knotiq_production_seed',
    action: 'created',
    details: {
      message: '100% Authentic Knotiq Rugs production data seeded successfully across all 15 modules',
      leadsCount: leadsInput.length,
      callsCount: callsData.length,
      followUpsCount: followUpsData.length,
      tasksCount: tasksData.length,
      notesCount: notesData.length,
      mindmapNodesCount: 7
    }
  });

  logger.info('================================================================');
  logger.info('Knotiq Rugs Production Data Seeding Completed Successfully!');
  logger.info(`User: ${USER_ID}`);
  logger.info(`Leads Seeded: ${leadsInput.length}`);
  logger.info(`Calls Seeded: ${callsData.length}`);
  logger.info(`FollowUps Seeded: ${followUpsData.length}`);
  logger.info(`Tasks Seeded: ${tasksData.length}`);
  logger.info(`CalendarEvents Seeded: ${calendarEventsData.length}`);
  logger.info(`OutreachLogs Seeded: ${outreachLogs.length}`);
  logger.info(`Notes Seeded: ${notesData.length}`);
  logger.info(`Campaigns Seeded: ${campaignsData.length}`);
  logger.info(`ContentPosts Seeded: ${postsData.length}`);
  logger.info(`Mindmap Nodes Seeded: 7`);
  logger.info('================================================================');
}

if (require.main === module) {
  seedKnotiqProductionData()
    .then(() => {
      console.log('SUCCESS: Knotiq Rugs Production Data successfully seeded into local database.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('ERROR during seeding:', err);
      process.exit(1);
    });
}

module.exports = seedKnotiqProductionData;
