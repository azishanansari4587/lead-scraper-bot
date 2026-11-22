import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Printer,
  Sparkles,
  Layers,
  Clock,
  User,
  Target,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  X,
  Filter
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui';

// The complete Knotiq Rugs 10-Branch Strategic Growth Tree
const MINDMAP_DATA = [
  {
    id: 'pipeline',
    title: '1. B2B Sales Pipeline & Closing',
    tagline: 'Turning cold designer leads into high-margin custom rug purchase orders',
    color: '#F59E0B',
    accentBg: 'rgba(245, 158, 11, 0.1)',
    nodes: [
      {
        id: 'pipe-1',
        title: 'Lead Ingestion & Micro-Segment Tagging',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Daily (09:00 - 09:30)',
        costEffort: '0 AED / 30 mins daily',
        kpi: '100% of newly scraped leads tagged with buyer type within 24h',
        dependsOn: 'Search & Scrape discovery running',
        why: 'Cold B2B sales fail when generic pitches are sent to specialized buyers. A luxury villa interior designer in Jumeirah needs bespoke New Zealand wool tufted specs, whereas a hospitality procurement manager in Downtown Dubai cares about 500+ sqm fire-rated commercial nylon or heavy wool blends.',
        how: 'Review newly scraped leads in Knotiq Command Center. Tag each lead with Buyer Type: Interior Designer (Residential/Commercial), Hotel/Hospitality, Rug Retailer/Showroom, Fitout Contractor, or Property Developer. Assign estimated project tier (Tier 1 Luxury, Tier 2 Mid-High).'
      },
      {
        id: 'pipe-2',
        title: '3-Touch Cold Outreach Playbook (WhatsApp + Email)',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Ongoing (Batch 15-20 leads/day)',
        costEffort: '0 AED / 45 mins daily',
        kpi: '20-25% first-reply rate across WhatsApp + Email',
        dependsOn: 'Verified phone numbers & email templates',
        why: 'In the UAE B2B design ecosystem, email gets buried, but WhatsApp gets opened within 4 minutes. A multi-channel sequence ensures maximum reach without spamming.',
        how: 'Day 1: WhatsApp audio/text intro with 1 high-res image of a recent custom hand-tufted rug delivered in Dubai + short value hook (21-day direct-loom turnaround vs European 10-week imports). Day 4: Project spotlight / video of artisan carving in Bhadohi. Day 7: Physical Swatch Kit offer delivered to their office.'
      },
      {
        id: 'pipe-3',
        title: 'The "Physical Swatch Box" In-Person Closer',
        priority: 'P0',
        owner: 'Founder (Ajman Office)',
        timeframe: 'Weekly on Tuesday/Thursday afternoons',
        costEffort: '45 AED per box (yarn tufts + box) + courier/fuel',
        kpi: '60% quote request rate from designers who receive the physical box',
        dependsOn: 'Curated 12x12" tuft samples from Bhadohi',
        why: 'Interior designers NEVER specify a 25,000 AED rug from a digital PDF. They must feel pile density, wool softness (100% NZ Wool vs Indian blend), and check sheen (botanical silk/Tencel vs viscose). Once your physical swatch sits on their material mood board, Knotiq is on their vendor shortlist.',
        how: 'Assemble Knotiq Luxury Sample Kits: 6 mini-swatches (Cut Pile 100% NZ Wool, Loop Pile, Wool + Botanical Silk blend, Carved High-Low, Fire-Rated Hospitality Spec, Hand-Knotted 60-knot swatch) + engraved metal Knotiq tag + QR code linking to digital spec sheets. Hand-deliver or send via Careem Box to Dubai Design District (D3) & Al Quoz design studios.'
      },
      {
        id: 'pipe-4',
        title: '4-Hour Rapid Quotation Engine',
        priority: 'P1',
        owner: 'Founder + Bhadohi Costing Lead',
        timeframe: 'Within 4 hours of receiving CAD/render',
        costEffort: '0 AED / 20 mins per quote',
        kpi: '< 4 hour turnaround time; > 35% quote-to-deposit win rate',
        dependsOn: 'Standardized sqm cost calculator',
        why: 'Designers work on brutal deadlines for client presentations. The rug manufacturer that returns a clean, branded PDF quote with 3D render preview in 4 hours wins the project before competitors even reply.',
        how: 'Use standardized Knotiq Pricing Matrix: Base Loom Cost (Bhadohi) + International Air Cargo (DDP Dubai) + Local Delivery + Gross Margin (45-55%). Send professional quote with breakdown: Size, Pile Height, Yarn Specification, Delivery Date, and 50% Advance terms.'
      },
      {
        id: 'pipe-5',
        title: 'Deposit Lock & Formal CAD Strike-Off Approval',
        priority: 'P0',
        owner: 'Founder + Bhadohi CAD Artist',
        timeframe: 'Within 48 hours of quote acceptance',
        costEffort: '0 AED',
        kpi: '100% signed production approvals before loom warping begins',
        dependsOn: 'Client 50% bank transfer received in UAE bank',
        why: 'Custom manufacturing without signed strike-off approvals is financial suicide. Never buy raw yarn or warp looms without written design approval and cleared deposit.',
        how: 'Generate digital 2D CAD artwork showing exact Pantone / ARS yarn color codes, pile direction, carving lines, and finishing borders. Require client digital sign-off and receipt of 50% wire transfer to Knotiq Ajman account before Bhadohi looms start spinning.'
      }
    ]
  },
  {
    id: 'leadgen',
    title: '2. Lead Generation & Target Scraping',
    tagline: 'Building a verified database of 1,000+ UAE & GCC luxury rug specifiers',
    color: '#10B981',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    nodes: [
      {
        id: 'lead-1',
        title: 'Google Maps Scraping: D3, Al Quoz, Downtown, Business Bay',
        priority: 'P0',
        owner: 'Founder (Scraper Bot)',
        timeframe: 'Weekly automated runs (Sundays)',
        costEffort: '0 AED (Local scraper engine)',
        kpi: '50-75 fresh, deduplicated leads enriched weekly',
        dependsOn: 'Knotiq Lead Scraper Bot presets',
        why: 'Concentration of high-net-worth villa and commercial interior designers in Dubai is geographically concentrated in Dubai Design District (D3), Al Quoz industrial creative zones, Business Bay, and Jumeirah.',
        how: 'Configure SearchScrape presets with targeted keywords: "interior design consultant Dubai", "luxury villa interior designer Jumeirah", "hospitality fitout contractor Dubai", "penthouse interior architect UAE". Run extraction, verify trade license address, export clean dataset.'
      },
      {
        id: 'lead-2',
        title: 'LinkedIn Sales Navigator Extraction & Direct Decision-Maker Hunting',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Twice weekly (Wednesdays & Saturdays)',
        costEffort: 'LinkedIn Sales Nav subscription / 2 hrs weekly',
        kpi: '25 verified Principal Designers / Head of FF&E added per week',
        dependsOn: 'Sales Navigator filter setup',
        why: 'Reaching generic "info@" emails yields low conversion. Reaching the "Senior FF&E Designer" (Furniture, Fixtures & Equipment) or "Principal Architect" puts you directly in front of the person choosing rug vendors.',
        how: 'Filter for UAE-based professionals with job titles: "FF&E Designer", "Interior Architect", "Managing Director Interior Design", "Procurement Manager Hospitality". Cross-reference company websites to capture direct WhatsApp / mobile numbers where public.'
      },
      {
        id: 'lead-3',
        title: 'Directory Mining: Index Dubai, CID (Commercial Interior Design), Downtown Design',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Monthly sprint',
        costEffort: '0 AED',
        kpi: 'Complete directory of 200+ exhibiting design firms and award nominees',
        dependsOn: 'Exhibitor list web scraping',
        why: 'Firms paying 50,000+ AED to exhibit or attend Index Dubai and Downtown Design have active, funded projects and demanding high-budget clients.',
        how: 'Scrape and curate exhibitor lists, speaker panels, and award shortlists from Commercial Interior Design (CID) Awards and Index Dubai. Ingest into Knotiq Command Center tagged with "High-Value Target".'
      },
      {
        id: 'lead-4',
        title: 'Phone & WhatsApp Verification Filter',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Pre-outreach gate',
        costEffort: '0 AED',
        kpi: '> 95% deliverability; 0 WhatsApp account flags',
        dependsOn: 'Lead import',
        why: 'Sending cold WhatsApp messages to landlines or inactive numbers burns time and risks account flagging.',
        how: 'Filter scraped phone numbers in Knotiq Bot. Strip invalid country codes, ensure +971 format, filter out landlines (+971 4 xxx xxxx vs +971 5x xxx xxxx). Only queue mobile numbers for WhatsApp outreach.'
      }
    ]
  },
  {
    id: 'outreach',
    title: '3. Multi-Channel Cold Outreach & Scripts',
    tagline: 'High-touch, respectful B2B relationship building that opens designer doors',
    color: '#8B5CF6',
    accentBg: 'rgba(139, 92, 246, 0.1)',
    nodes: [
      {
        id: 'out-1',
        title: 'Designer-First Value Proposition Hook',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Immediate template standardization',
        costEffort: '0 AED',
        kpi: 'Zero "catalog spam" sent; personalized hook in every message',
        dependsOn: 'TemplatesTab in Marketing Hub',
        why: 'Designers hate generic wholesaler catalogs. They love 3 things: 1) Custom sizes with no shape restrictions; 2) Exact color matching to their fabric boards; 3) Fast 21-day direct-loom delivery without middlemen markup.',
        how: 'Draft Variant A & B in Knotiq Templates: "Hi [Name], loved your recent [Project Name/Style] project. We manufacture custom hand-tufted rugs directly on our looms in Bhadohi for Dubai designers—delivering bespoke NZ wool & silk rugs in 21 days with full DDP delivery to your site. Would love to send a complimentary 6-piece swatch kit to your studio."'
      },
      {
        id: 'out-2',
        title: 'WhatsApp Visual Social Proof (4-Second Loom Video)',
        priority: 'P0',
        owner: 'Founder + Bhadohi Team',
        timeframe: 'Captured weekly from Bhadohi factory',
        costEffort: '0 AED',
        kpi: '3x higher reply rate compared to plain text messages',
        dependsOn: 'Factory footage shared via WhatsApp',
        why: 'In a world of drop-shippers, showing a genuine master weaver hand-shearing a custom rug with Bhadohi loom sounds proves you are the actual factory.',
        how: 'Record high-res 4K, 5-second vertical clips: artisan hand-tufting with pneumatic gun, organic botanical yarn dyeing, hand-carving high-low pile. Attach as lightweight media on Day 4 follow-up.'
      },
      {
        id: 'out-3',
        title: 'Strict Pacing & WhatsApp Ban Prevention',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Built into Daily Sales Power Hour',
        costEffort: '0 AED',
        kpi: '0 account suspensions; consistent 15-20 personalized touches daily',
        dependsOn: 'Knotiq Daily Cap Settings',
        why: 'Automated blast spamming gets WhatsApp numbers banned within 48 hours. Human-paced, conversational outreach builds 50,000 AED client relationships.',
        how: 'Limit outbound touches to 15-20 new leads per day. Pacing intervals: 90-180 seconds between messages. Use WhatsApp Business with verified profile, Knotiq Ajman office location, and catalog links.'
      },
      {
        id: 'out-4',
        title: 'The "Revive Stalled Quote" Day 14 Follow-up',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Every Monday morning review',
        costEffort: '0 AED',
        kpi: '15-20% revival rate on pending quotations',
        dependsOn: 'Leads Pipeline quote stage tracking',
        why: 'Designers frequently get stalled by client budget approvals. A supportive, problem-solving check-in closes deals that would otherwise slip away.',
        how: 'Send personalized message: "Hi [Name], following up on the 3.5m x 2.8m wool-silk quote for the Palm Jumeirah villa. If the client is optimizing budget, we can adjust the botanical silk ratio to 30% or optimize pile density to maintain the exact look while saving 18% on total cost. Let me know if that helps your presentation!"'
      }
    ]
  },
  {
    id: 'marketing',
    title: '4. Inbound Brand & Content Strategy',
    tagline: 'Establishing Knotiq as the definitive artisan rug manufacturer in the GCC',
    color: '#EC4899',
    accentBg: 'rgba(236, 72, 153, 0.1)',
    nodes: [
      {
        id: 'mkt-1',
        title: 'Instagram & LinkedIn Proof Engine (3x/Week Rhythm)',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Mon, Wed, Fri (Scheduled in Knotiq Content Calendar)',
        costEffort: '0 AED / 1 hr weekly planning',
        kpi: '12 high-authority project/manufacturing posts published monthly',
        dependsOn: 'Knotiq Content Calendar (Phase C)',
        why: 'UAE interior designers vet vendors on Instagram before replying to your WhatsApp message. If your feed looks amateur, you lose the deal before the conversation starts.',
        how: 'Post 3 distinct pillars: 1) Reel: Bhadohi craftsmanship & yarn carving close-ups; 2) Carousel: Before/After 3D render vs delivered rug in a Dubai penthouse; 3) Technical Post: NZ Wool vs Viscose durability guide for GCC climates.'
      },
      {
        id: 'mkt-2',
        title: 'Project Case Studies & Designer Features',
        priority: 'P1',
        owner: 'Founder + Designer Clients',
        timeframe: 'Monthly upon project completion',
        costEffort: 'Photographer tip / high-res phone captures',
        kpi: '1 featured designer partnership case study published per month',
        dependsOn: 'Completed and delivered custom rug orders',
        why: 'Interior designers love publicity. By tagging their studio and praising their design vision, they re-share your post to their thousands of design followers.',
        how: 'Request permission to photograph installed rug in finished space. Write case study: "Custom 4x3m Organic Curved Rug for Luxury Villa in Emirates Hills — Designed by [Studio], Handcrafted by Knotiq Rugs".'
      },
      {
        id: 'mkt-3',
        title: 'Digital Spec Sheets & Technical FF&E Pack',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Week 2 setup',
        costEffort: '0 AED (Canva / PDF spec)',
        kpi: 'Downloadable PDF ready for any designer procurement team',
        dependsOn: 'Yarn specifications and lab test certificates',
        why: 'Commercial and hospitality projects require Fire Retardant (FR) certifications (CRI Green Label Plus, IMO fire rating, heavy traffic durability tests).',
        how: 'Assemble a 4-page Knotiq Spec Guide: Pile types, wool microns, yarn densities, backing latex specifications, fire compliance certifications, and maintenance guidelines.'
      }
    ]
  },
  {
    id: 'google',
    title: '5. Google Search & Local Presence',
    tagline: 'Capturing high-intent B2B search traffic for custom rugs across UAE',
    color: '#38BDF8',
    accentBg: 'rgba(56, 189, 248, 0.1)',
    nodes: [
      {
        id: 'goog-1',
        title: 'Google Business Profile Optimization (Ajman Office & Warehouse)',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Week 1 setup + weekly photo update',
        costEffort: '0 AED',
        kpi: 'Top 3 Map Pack ranking for "custom rug manufacturer UAE / Ajman / Dubai"',
        dependsOn: 'Verified Google Business Profile',
        why: 'Procurement heads and expats search "custom rugs Dubai" or "handmade carpet supplier UAE" on Google when they have immediate budget and an active deadline.',
        how: 'Claim & optimize GBP: Primary category "Rug Store" + secondary "Carpet Manufacturer". Add exact keywords in description: custom hand tufted rugs, bespoke handmade carpets, hospitality carpet supplier. Post 5 new photos weekly of completed rugs and loom craftsmanship.'
      },
      {
        id: 'goog-2',
        title: 'High-Intent B2B SEO Landing Pages',
        priority: 'P2',
        owner: 'Founder',
        timeframe: 'Month 2 build',
        costEffort: '0 AED / 3 hrs per page',
        kpi: 'Page 1 organic rankings for high-intent GCC commercial rug keywords',
        dependsOn: 'Website setup',
        why: 'A single high-ranking page for "hospitality carpet supplier UAE" can generate 200,000+ AED in annual hotel refurbishment contracts without ad spend.',
        how: 'Create targeted pillar pages: /custom-rugs-dubai, /hospitality-carpets-uae, /hand-tufted-rug-manufacturer-india, /interior-designer-rug-program. Include FAQs, technical specs, and instant WhatsApp inquiry button.'
      },
      {
        id: 'goog-3',
        title: 'Review Generation Flywheel (5-Star Verified Client Reviews)',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Within 48 hours of successful rug delivery',
        costEffort: '0 AED',
        kpi: '15+ detailed 5-star Google reviews with photos within 90 days',
        dependsOn: 'Client delivery sign-off',
        why: 'Nothing builds trust faster for a high-ticket transaction than detailed reviews from other Dubai interior designers praising punctuality, pile softness, and loom direct pricing.',
        how: 'Send personalized WhatsApp review link: "Hi [Name], so thrilled to see the villa rug installed! Would mean the world to our Bhadohi artisan team if you could drop a quick 2-line review on Google. Here is direct link [Google Review Link]."'
      }
    ]
  },
  {
    id: 'samples',
    title: '6. Physical Swatch Kit & Sampling Engine',
    tagline: 'The tangible sales asset that converts cold inquiries into locked contracts',
    color: '#F97316',
    accentBg: 'rgba(249, 115, 22, 0.1)',
    nodes: [
      {
        id: 'smp-1',
        title: 'Standardized 6-Tuft Luxury Architect Kit',
        priority: 'P0',
        owner: 'Founder (Assembly) + Bhadohi (Weaving)',
        timeframe: 'Keep 10 kits pre-assembled in Ajman inventory',
        costEffort: '40-50 AED per kit manufacturing cost',
        kpi: 'Deliver 5 kits weekly to qualified Tier 1 design studios',
        dependsOn: 'Inventory of sample tufts shipped from Bhadohi',
        why: 'In B2B textiles, touch is everything. If a designer has your physical samples in their studio library, they grab your yarn when making client mood boards.',
        how: 'Kit contents: 1) 100% New Zealand Wool 4500g cut pile; 2) Hand-spun New Zealand Wool with high-low loop; 3) 50% Wool / 50% Botanical Bamboo Silk; 4) 100% Pure Botanical Silk luxury sheen; 5) Multi-level hand-carved sample; 6) Commercial contract-grade heavy loop. Packaged in matte black branded Knotiq box with gold foil lettering.'
      },
      {
        id: 'smp-2',
        title: 'Rapid 72-Hour Custom Color Pom Delivery',
        priority: 'P1',
        owner: 'Founder (Ajman Office Stock)',
        timeframe: 'Within 48-72h of designer palette request',
        costEffort: 'Stock ARS / Pantone yarn pom box in Ajman',
        kpi: '100% color approval match before loom setup',
        dependsOn: 'ARS 600 or Chromatics color pom box held in UAE',
        why: 'Color mismatch is the #1 reason custom rugs get rejected. If the client specified warm taupe and received grey beige, you absorb a 20,000 AED loss.',
        how: 'Maintain full set of standardized wool color poms in the Ajman office. When a designer shares a Benjamin Moore or RAL paint swatch, match exact yarn pom and hand-courier it to their studio for physical approval.'
      },
      {
        id: 'smp-3',
        title: 'Sample Recovery & Follow-Up Protocol',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Day 5 after sample kit delivery',
        costEffort: '0 AED',
        kpi: '100% of sample deliveries followed up within 5 business days',
        dependsOn: 'Sample delivery logged in Knotiq CRM',
        why: 'Sending a box and going silent wastes 50 AED. Following up when the box arrives transforms a free gift into an active project RFQ (Request for Quote).',
        how: 'Track delivery via courier. When delivered: "Hi [Name], reception confirmed the Knotiq Swatch Box arrived at your D3 studio today. Hope you love the New Zealand wool touch! Do you have any active residential or commercial projects where we can quote sizes for you this month?"'
      }
    ]
  },
  {
    id: 'production',
    title: '7. Bhadohi Manufacturing & QC Bridge',
    tagline: 'Direct-from-loom advantage: 21-day production, master quality control',
    color: '#6366F1',
    accentBg: 'rgba(99, 102, 241, 0.1)',
    nodes: [
      {
        id: 'prod-1',
        title: 'Daily 14:00 UAE / 15:30 IST Production Sync',
        priority: 'P0',
        owner: 'Founder + Bhadohi Loom Master',
        timeframe: 'Daily (Mon - Sat) at 14:00 Dubai time',
        costEffort: '0 AED / 20 mins daily',
        kpi: 'Zero production surprises; 100% on-time loom milestone completion',
        dependsOn: 'Bhadohi factory WhatsApp video connection',
        why: 'As a solo founder in UAE with manufacturing in India, production slip-ups kill client trust. A strict 20-minute daily operational sync ensures problems are caught before yarn is cut.',
        how: 'Review active production board: 1) Yarn dyeing & lab dips; 2) Loom warping & tufting progress; 3) Latexing & secondary backing; 4) Hand carving & shearing; 5) Final dispatch readiness. Check photos and videos of each active loom.'
      },
      {
        id: 'prod-2',
        title: 'Mandatory 5-Point 4K Video Quality Check Before Packing',
        priority: 'P0',
        owner: 'Bhadohi QC Lead',
        timeframe: 'Before rolling and packing any rug in Bhadohi',
        costEffort: '0 AED',
        kpi: '0% defect rate upon arrival in UAE; 100% client acceptance',
        dependsOn: 'High-res phone camera & measuring tape',
        why: 'Discovering a size error (e.g. 290cm instead of 300cm) after international air freight to Dubai costs thousands in freight, duties, and client penalties.',
        how: 'Bhadohi team must record and send a single continuous 4K video showing: 1) Steel tape measurement of exact length and width; 2) Backing latex adhesion & binding edges; 3) Sunlight / balanced white light color check against master approved pom; 4) Hand shear pile consistency; 5) Water droplet / stain repelling check if treated.'
      },
      {
        id: 'prod-3',
        title: 'Raw Material Buffer Stock (NZ Wool & Botanical Silk)',
        priority: 'P1',
        owner: 'Bhadohi Procurement',
        timeframe: 'Monthly replenishment',
        costEffort: 'Working capital allocation for 250kg yarn buffer',
        kpi: 'Immediate 24h loom start upon 50% client deposit',
        dependsOn: 'Cash flow management',
        why: 'Waiting 10 days to source raw New Zealand wool after receiving an order destroys your 21-day delivery promise.',
        how: 'Keep a rolling buffer of 200kg premium un-dyed New Zealand wool yarn and 100kg botanical silk yarn at the Bhadohi facility so dyeing starts within 24 hours of CAD approval.'
      }
    ]
  },
  {
    id: 'logistics',
    title: '8. Logistics, Shipping & Cash Flow',
    tagline: 'Reliable air/sea freight from Varanasi to Dubai, 100% DDP seamless delivery',
    color: '#14B8A6',
    accentBg: 'rgba(20, 184, 166, 0.1)',
    nodes: [
      {
        id: 'log-1',
        title: 'Air Freight Express Corridor (Varanasi / Delhi to DXB / SHJ)',
        priority: 'P0',
        owner: 'Founder + Air Cargo Partner',
        timeframe: '5-7 calendar days transit door-to-door',
        costEffort: 'Standard air cargo tariff (~18-24 AED/kg)',
        kpi: 'Consistent 5-7 day door-to-door transit time',
        dependsOn: 'Export paperwork (IEC, Commercial Invoice, Packing List)',
        why: 'Air cargo is the secret to beating European rug importers who take 8 to 12 weeks. Designers happily pay premium prices for a 21-day turnkey delivery.',
        how: 'Consolidate completed rugs in Bhadohi. Truck to Varanasi Airport (VNS) or Delhi Cargo Hub. Fly direct to Dubai (DXB) or Sharjah (SHJ). Clear customs using UAE Trade License with DDP (Delivered Duty Paid) so client receives the rug hassle-free.'
      },
      {
        id: 'log-2',
        title: 'The 50/40/10 Bulletproof Payment Term Structure',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Contract agreement gate',
        costEffort: '0 AED',
        kpi: 'Zero outstanding receivables after final installation',
        dependsOn: 'Client contract terms',
        why: 'Letting clients pay 100% after delivery in the UAE leads to 60-90 day payment delays, suffocating working capital.',
        how: 'Standard Terms: 50% Advance deposit before loom setup; 40% Balance upon video QC approval from Bhadohi prior to dispatch from India; 10% on physical delivery and placement in UAE. For trusted repeat designers: 50% deposit, 50% against delivery note.'
      },
      {
        id: 'log-3',
        title: 'Ajman White-Glove Staging & Site Installation',
        priority: 'P1',
        owner: 'Founder + Local Delivery Team',
        timeframe: 'Scheduled 48h before client delivery date',
        costEffort: '150-250 AED per delivery van + 2 helpers',
        kpi: '100% flawless handover with underlay fitted & furniture replaced',
        dependsOn: 'Custom underlay inventory in Ajman',
        why: 'Dropping a rolled rug in plastic at the door is what cheap couriers do. Rolling it out, steaming pile folds, placing felt underlay, and arranging client furniture justifies a 15,000+ AED luxury price point.',
        how: 'Inspect rug at Ajman staging facility. Vacuum and groom pile with soft brush. Coordinate delivery with designer on-site. Place non-slip anti-microbial underlay. Position rug, tuck edges, steam any packing pressure lines, and take delivery sign-off signature.'
      }
    ]
  },
  {
    id: 'rhythm',
    title: '9. Operations, Time Mastery & Founder Rhythm',
    tagline: 'Solo founder execution system: eliminating burnout and guaranteeing daily momentum',
    color: '#EAB308',
    accentBg: 'rgba(234, 179, 8, 0.1)',
    nodes: [
      {
        id: 'rhy-1',
        title: 'The 09:00 - 10:30 Sales Power Hour (Non-Negotiable)',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Daily (Mon - Fri) 09:00 - 10:30 UAE Time',
        costEffort: '0 AED / 90 minutes focused attention',
        kpi: '15-20 outreach touches sent; 5 follow-ups executed every morning',
        dependsOn: 'Knotiq Today Command Center',
        why: 'If the founder does not sell before 10:30 AM, operational fires (freight, emails, loom questions) will consume the entire day, leaving pipeline dry.',
        how: 'Phone on Do Not Disturb. Open Knotiq Command Center Today Hub. Execute 3 MITs: 1) Send Day 1 / Day 4 / Day 7 follow-ups; 2) Outreach to 15 newly scraped designers; 3) Send pending quotes from yesterday. No admin or social media allowed during this block.'
      },
      {
        id: 'rhy-2',
        title: 'The 18:30 Evening Review & Streak Maintenance',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Daily at 18:30 UAE Time',
        costEffort: '0 AED / 15 minutes',
        kpi: '100% daily streak logged in Knotiq Command Center',
        dependsOn: 'Today Command Center completion',
        why: 'Unreviewed days compound into chaotic weeks. Logging daily wins, quotes sent, and setting tomorrow\'s 3 MITs clears mental anxiety and creates unstoppable compounding momentum.',
        how: 'Open Knotiq Evening Review. Check metrics: Leads contacted, Swatch kits delivered, Quotes out, Revenue booked. Log reflection note in Founder Notebook. Define top 3 Most Important Tasks (MITs) for tomorrow.'
      },
      {
        id: 'rhy-3',
        title: 'Sunday Pipeline & Strategy Audit (60 Mins)',
        priority: 'P1',
        owner: 'Founder',
        timeframe: 'Every Sunday at 17:00 UAE Time',
        costEffort: '0 AED / 60 minutes',
        kpi: 'Clean CRM pipeline; next week\'s sample kits and scrapers prepped',
        dependsOn: 'Knotiq Reports & CRM data',
        why: 'Starting Monday morning wondering "what should I do today?" costs 2 hours of prime selling time.',
        how: '1) Run weekly scraper to load 100 new leads into queue; 2) Review stalled deals and schedule Monday calls; 3) Verify sample kit boxes in Ajman office; 4) Check Bhadohi dispatch schedule for the upcoming week.'
      }
    ]
  },
  {
    id: 'safeguards',
    title: '10. Risk Safeguards & Quality Control',
    tagline: 'Protecting capital, reputation, and client trust in custom manufacturing',
    color: '#EF4444',
    accentBg: 'rgba(239, 68, 68, 0.1)',
    nodes: [
      {
        id: 'safe-1',
        title: 'Anti-Color Discrepancy Protocol (Physical Pom Sign-Off)',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Pre-production gate on every project > 10,000 AED',
        costEffort: '0 AED',
        kpi: '0% color rejection disputes',
        dependsOn: 'Client signed strike-off document',
        why: 'Digital screens show RGB colors differently (iPhone vs Samsung vs calibrated monitor). Weaving a rug based on a WhatsApp photo screenshot guarantees a color dispute.',
        how: 'For any custom color, either: 1) Match to standard ARS / Pantone TPG code in person; or 2) Send physical 2x2" dyed yarn pom to the designer with a sign-off sticker before loom weaving begins.'
      },
      {
        id: 'safe-2',
        title: 'Loom Monsoon & Weather Contingency Buffer (July - Sept)',
        priority: 'P1',
        owner: 'Bhadohi Production Lead',
        timeframe: 'Monsoon season buffer (July - September)',
        costEffort: 'Dehumidifiers in Bhadohi finishing room',
        kpi: 'Zero weather-related delivery delays passed to UAE clients',
        dependsOn: 'Electric drying and dehumidification setups in Bhadohi',
        why: 'High humidity during Uttar Pradesh monsoon slows latex curing and outdoor rug drying by 4 to 6 days. Not planning for this leads to broken delivery promises.',
        how: 'Equip Bhadohi finishing facility with closed-room industrial blowers and dehumidifiers. Add 4 calendar days buffer to customer quoted timeline during monsoon months.'
      },
      {
        id: 'safe-3',
        title: 'Air Cargo Transit Loss & Damage Insurance',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Every international shipment',
        costEffort: '~0.3% of declared consignment value',
        kpi: '100% financial recovery in case of water/tear transit damage',
        dependsOn: 'Cargo insurance policy with freight forwarder',
        why: 'Air cargo pallets can experience forklift tears or tarmac rain damage during airport transshipment.',
        how: 'Mandate double-layer waterproof packaging: 1) Heavy polyethylene inner wrap heat-sealed; 2) High-density woven jute/poly outer bag stitched with nylon thread. Ensure All-Risk Marine/Air Cargo insurance coverage on every Air Waybill.'
      },
      {
        id: 'safe-4',
        title: 'Client Ghosting Mitigation: Non-Refundable Custom Deposit',
        priority: 'P0',
        owner: 'Founder',
        timeframe: 'Contract terms clause',
        costEffort: '0 AED',
        kpi: 'Zero unrecovered manufacturing costs from cancelled custom orders',
        dependsOn: 'Standard Knotiq sales quotation terms',
        why: 'If a client cancels a custom 5m curved purple rug halfway through weaving, it cannot be resold to anyone else.',
        how: 'Explicitly state in quotation and invoice: "Custom bespoke rugs are made to individual client specifications and dimensions. The 50% advance deposit covers dedicated raw yarn procurement and artisan loom warping, and is strictly non-refundable once CAD strike-off is approved."'
      }
    ]
  }
];

export default function Mindmap() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [collapsedBranches, setCollapsedBranches] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [completedActions, setCompletedActions] = useState(() => {
    try {
      const saved = localStorage.getItem('knotiq_mindmap_completed_actions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save progress to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('knotiq_mindmap_completed_actions', JSON.stringify(completedActions));
    } catch (e) {
      console.error('Failed to save mindmap progress', e);
    }
  }, [completedActions]);

  // Toggle action completion
  const toggleAction = (nodeId) => {
    setCompletedActions((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Toggle branch collapse
  const toggleBranch = (branchId) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [branchId]: !prev[branchId]
    }));
  };

  const expandAll = () => setCollapsedBranches({});
  const collapseAll = () => {
    const all = {};
    MINDMAP_DATA.forEach((b) => (all[b.id] = true));
    setCollapsedBranches(all);
  };

  // Filtered nodes calculation
  const totalNodesCount = useMemo(() => {
    return MINDMAP_DATA.reduce((acc, b) => acc + b.nodes.length, 0);
  }, []);

  const completedCount = useMemo(() => {
    return Object.values(completedActions).filter(Boolean).length;
  }, [completedActions]);

  const progressPct = totalNodesCount > 0 ? Math.round((completedCount / totalNodesCount) * 100) : 0;

  // Search filtering
  const filteredBranches = useMemo(() => {
    return MINDMAP_DATA.map((branch) => {
      if (selectedBranch !== 'all' && branch.id !== selectedBranch) {
        return null;
      }
      const matchingNodes = branch.nodes.filter((node) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          node.title.toLowerCase().includes(q) ||
          node.why.toLowerCase().includes(q) ||
          node.how.toLowerCase().includes(q) ||
          node.kpi.toLowerCase().includes(q) ||
          node.owner.toLowerCase().includes(q)
        );
      });
      if (matchingNodes.length === 0 && searchTerm) return null;
      return {
        ...branch,
        nodes: matchingNodes
      };
    }).filter(Boolean);
  }, [selectedBranch, searchTerm]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Banner & Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.1))',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-primary)'
                }}
              >
                <Compass size={20} />
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
                Knotiq Rugs — B2B Growth Engine Mindmap
              </h1>
              <Badge variant="warning" style={{ fontSize: '12px' }}>
                Bhadohi ➔ UAE Direct Loom Supply Chain
              </Badge>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '800px' }}>
              Complete end-to-end strategic execution tree: From cold designer scraping and sample box delivery to 21-day direct loom production and cash flow protection.
            </p>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/docs/knotiq_growth_mindmap.html', '_blank')}
              title="Open full interactive HTML mindmap in a new tab"
            >
              <ExternalLink size={14} style={{ marginRight: '6px' }} />
              Standalone HTML View
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} title="Print Strategy Blueprint">
              <Printer size={14} style={{ marginRight: '6px' }} />
              Print / PDF
            </Button>
          </div>
        </div>

        {/* Progress Bar & High-Level Stats */}
        <div
          style={{
            marginTop: '20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Execution Milestone Progress</span>
              <span style={{ color: 'var(--gold-primary)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                {completedCount} of {totalNodesCount} Actions Completed ({progressPct}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #F59E0B, #10B981)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', justifyContent: 'flex-end', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branches</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>10 Tracks</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Items</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>{totalNodesCount} Nodes</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Supply Cycle</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success-text)', fontFamily: 'Outfit, sans-serif' }}>21 Days Turnaround</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter Bar and Expand/Collapse Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)'
              }}
            />
            <input
              type="text"
              placeholder="Search actions, KPIs, tactics (e.g. swatch box, 4-hour quote, Bhadohi QC)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '13px'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Branch Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: 'var(--text-dim)' }} />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{
                padding: '9px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All 10 Branches</option>
              {MINDMAP_DATA.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expand / Collapse Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="ghost" size="sm" onClick={expandAll} style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Expand All
          </Button>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <Button variant="ghost" size="sm" onClick={collapseAll} style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Main Mindmap Tree & Branches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredBranches.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '12px'
            }}
          >
            <Compass size={36} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-heading)' }}>No matching strategic actions found</div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Try searching for something else or reset the branch filter.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setSelectedBranch('all'); }}>
              Reset Filters
            </Button>
          </div>
        ) : (
          filteredBranches.map((branch) => {
            const isCollapsed = Boolean(collapsedBranches[branch.id]);
            const branchCompleted = branch.nodes.filter((n) => completedActions[n.id]).length;
            const branchTotal = branch.nodes.length;
            const branchPct = Math.round((branchCompleted / branchTotal) * 100);

            return (
              <div
                key={branch.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isCollapsed ? 'var(--border-subtle)' : branch.color + '40'}`,
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: isCollapsed ? 'none' : `0 4px 20px ${branch.color}10`,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Branch Header */}
                <div
                  onClick={() => toggleBranch(branch.id)}
                  style={{
                    padding: '16px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isCollapsed ? 'transparent' : branch.accentBg,
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: branch.color,
                        boxShadow: `0 0 10px ${branch.color}`
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
                          {branch.title}
                        </span>
                        <Badge
                          variant={branchPct === 100 ? 'success' : 'neutral'}
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          {branchCompleted}/{branchTotal} Done ({branchPct}%)
                        </Badge>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {branch.tagline}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {isCollapsed ? <ChevronRight size={18} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-dim)' }} />}
                  </div>
                </div>

                {/* Nodes List */}
                {!isCollapsed && (
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
                    {branch.nodes.map((node) => {
                      const isDone = Boolean(completedActions[node.id]);

                      return (
                        <div
                          key={node.id}
                          style={{
                            background: isDone ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-surface-elevated)',
                            border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                            borderRadius: '10px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            {/* Node Header & Checkbox */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAction(node.id);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '2px 0 0 0',
                                    cursor: 'pointer',
                                    color: isDone ? 'var(--success-text)' : 'var(--text-dim)'
                                  }}
                                  title={isDone ? 'Mark as pending' : 'Mark as completed'}
                                >
                                  {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                                <div>
                                  <div
                                    onClick={() => setSelectedNode({ ...node, branchTitle: branch.title, branchColor: branch.color })}
                                    style={{
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      color: isDone ? 'var(--text-muted)' : 'var(--text-heading)',
                                      textDecoration: isDone ? 'line-through' : 'none',
                                      cursor: 'pointer',
                                      lineHeight: '1.4'
                                    }}
                                  >
                                    {node.title}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                    <Badge
                                      variant={node.priority === 'P0' ? 'error' : node.priority === 'P1' ? 'warning' : 'neutral'}
                                      style={{ fontSize: '10px', padding: '1px 6px' }}
                                    >
                                      {node.priority} Priority
                                    </Badge>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <User size={11} /> {node.owner}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={11} /> {node.timeframe}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Node Snippet (Why) */}
                            <p
                              style={{
                                margin: '10px 0 0 28px',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                lineHeight: '1.5',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {node.why}
                            </p>
                          </div>

                          {/* Footer with KPI and Detail Click */}
                          <div
                            style={{
                              paddingTop: '10px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11px'
                            }}
                          >
                            <span style={{ color: 'var(--gold-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Target size={12} /> {node.kpi}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedNode({ ...node, branchTitle: branch.title, branchColor: branch.color })}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-dim)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                transition: 'color 0.15s ease'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-heading)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                            >
                              Details <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Slide-Over Drawer for Node Details */}
      {selectedNode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedNode(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-accent)',
              boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
              overflowY: 'auto',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Top */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: selectedNode.branchColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedNode.branchTitle}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Title & Priority */}
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
                {selectedNode.title}
              </h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                <Badge variant={selectedNode.priority === 'P0' ? 'error' : selectedNode.priority === 'P1' ? 'warning' : 'neutral'}>
                  {selectedNode.priority} Priority
                </Badge>
                <Badge variant="outline">
                  <User size={12} style={{ marginRight: '4px' }} /> {selectedNode.owner}
                </Badge>
                <Badge variant="outline">
                  <Clock size={12} style={{ marginRight: '4px' }} /> {selectedNode.timeframe}
                </Badge>
              </div>

              {/* Detail Blocks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* WHY */}
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    WHY THIS MATTERS (Strategic Logic)
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    {selectedNode.why}
                  </p>
                </div>

                {/* HOW */}
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    HOW TO EXECUTE (Playbook Step-by-Step)
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    {selectedNode.how}
                  </p>
                </div>

                {/* KPI */}
                <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    KEY PERFORMANCE INDICATOR (KPI / Done Metric)
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6', fontWeight: 500 }}>
                    {selectedNode.kpi}
                  </p>
                </div>

                {/* Meta Grid: Cost & Depends On */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      ESTIMATED COST / EFFORT
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 500 }}>
                      {selectedNode.costEffort}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      DEPENDS ON
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 500 }}>
                      {selectedNode.dependsOn}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '12px' }}>
              <Button
                variant={completedActions[selectedNode.id] ? 'outline' : 'primary'}
                style={{ flex: 1 }}
                onClick={() => toggleAction(selectedNode.id)}
              >
                {completedActions[selectedNode.id] ? (
                  <>
                    <CheckCircle2 size={16} style={{ marginRight: '6px' }} /> Completed (Click to Unmark)
                  </>
                ) : (
                  <>
                    <Circle size={16} style={{ marginRight: '6px' }} /> Mark Action as Complete
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedNode(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
