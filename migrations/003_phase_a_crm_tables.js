const { DataTypes } = require('sequelize');

async function safeCreateTable(queryInterface, tableName, attributes) {
  try {
    await queryInterface.createTable(tableName, attributes);
  } catch (err) {
    const isExists =
      err.name === 'SequelizeDatabaseError' &&
      (err.parent?.code === 'ER_TABLE_EXISTS_ERROR' ||
        err.parent?.errno === 1050 ||
        err.message?.includes('already exists') ||
        err.original?.message?.includes('already exists'));
    if (!isExists) throw err;
  }
}

async function safeAddColumn(queryInterface, tableName, columnName, attribute) {
  try {
    await queryInterface.addColumn(tableName, columnName, attribute);
  } catch (err) {
    const isDup =
      err.parent?.code === 'ER_DUP_FIELDNAME' ||
      err.parent?.errno === 1060 ||
      err.message?.includes('duplicate column') ||
      err.message?.includes('already exists');
    if (!isDup) throw err;
  }
}

async function safeAddIndex(queryInterface, tableName, fields, options = {}) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (err) {
    const isDup =
      err.parent?.code === 'ER_DUP_KEYNAME' ||
      err.parent?.errno === 1061 ||
      err.message?.includes('already exists') ||
      err.message?.includes('Duplicate key name');
    if (!isDup) throw err;
  }
}

module.exports = {
  up: async (queryInterface, sequelize) => {
    // 1. Add new columns to Leads table
    await safeAddColumn(queryInterface, 'Leads', 'buyerType', {
      type: DataTypes.STRING(50),
      defaultValue: 'unclassified'
    });
    await safeAddColumn(queryInterface, 'Leads', 'buyerTypeConfidence', {
      type: DataTypes.FLOAT,
      defaultValue: 0
    });
    await safeAddColumn(queryInterface, 'Leads', 'buyerTypeReason', {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'buyerTypeManual', {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    });
    await safeAddColumn(queryInterface, 'Leads', 'priority', {
      type: DataTypes.STRING(20),
      defaultValue: 'warm'
    });
    await safeAddColumn(queryInterface, 'Leads', 'assignedTo', {
      type: DataTypes.STRING(100),
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'detail', {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'project', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'platform', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'sizes', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'optedOut', {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    });

    // Migrate old lead statuses if any
    try {
      await sequelize.query("UPDATE Leads SET status = 'won' WHERE status = 'converted';");
      await sequelize.query("UPDATE Leads SET status = 'lost' WHERE status = 'rejected';");
    } catch (_) {
      // Non-blocking
    }

    // Safe indices on Leads
    await safeAddIndex(queryInterface, 'Leads', ['userId', 'buyerType']);
    await safeAddIndex(queryInterface, 'Leads', ['userId', 'priority']);
    await safeAddIndex(queryInterface, 'Leads', ['userId', 'nextFollowUpAt']);

    // 2. Calls Table
    await safeCreateTable(queryInterface, 'Calls', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING(100), allowNull: false },
      leadId: { type: DataTypes.INTEGER, allowNull: false },
      direction: { type: DataTypes.STRING(20), defaultValue: 'outbound' },
      calledAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      durationSec: { type: DataTypes.INTEGER, defaultValue: 0 },
      outcome: { type: DataTypes.STRING(50), defaultValue: 'connected' },
      summary: { type: DataTypes.TEXT, allowNull: true },
      nextAction: { type: DataTypes.STRING(255), allowNull: true },
      nextFollowUpAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.STRING(100), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await safeAddIndex(queryInterface, 'Calls', ['userId', 'leadId']);
    await safeAddIndex(queryInterface, 'Calls', ['userId', 'calledAt']);
    await safeAddIndex(queryInterface, 'Calls', ['userId', 'outcome']);

    // 3. CallScripts Table
    await safeCreateTable(queryInterface, 'CallScripts', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      buyerType: { type: DataTypes.STRING(50), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      scriptText: { type: DataTypes.TEXT, allowNull: false },
      objectionHandling: { type: DataTypes.TEXT, allowNull: true },
      tips: { type: DataTypes.TEXT, allowNull: true },
      isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await safeAddIndex(queryInterface, 'CallScripts', ['buyerType']);

    // 4. Notes Table (Polymorphic)
    await safeCreateTable(queryInterface, 'Notes', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING(100), allowNull: false },
      ownerType: { type: DataTypes.STRING(30), defaultValue: 'lead' },
      ownerId: { type: DataTypes.STRING(100), allowNull: true },
      title: { type: DataTypes.STRING(255), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      tags: { type: DataTypes.JSON, allowNull: true },
      pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await safeAddIndex(queryInterface, 'Notes', ['userId', 'ownerType', 'ownerId']);
    await safeAddIndex(queryInterface, 'Notes', ['userId', 'pinned']);
    await safeAddIndex(queryInterface, 'Notes', ['userId', 'createdAt']);

    // 5. FollowUps Table
    await safeCreateTable(queryInterface, 'FollowUps', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING(100), allowNull: false },
      leadId: { type: DataTypes.INTEGER, allowNull: false },
      dueAt: { type: DataTypes.DATE, allowNull: false },
      channel: { type: DataTypes.STRING(20), defaultValue: 'call' },
      step: { type: DataTypes.STRING(50), defaultValue: 'custom' },
      status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await safeAddIndex(queryInterface, 'FollowUps', ['userId', 'status', 'dueAt']);
    await safeAddIndex(queryInterface, 'FollowUps', ['userId', 'leadId']);
    await safeAddIndex(queryInterface, 'FollowUps', ['userId', 'dueAt']);

    // 6. OutreachLogs Table
    await safeCreateTable(queryInterface, 'OutreachLogs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING(100), allowNull: false },
      leadId: { type: DataTypes.INTEGER, allowNull: true },
      channel: { type: DataTypes.STRING(20), allowNull: false },
      step: { type: DataTypes.STRING(50), defaultValue: 'day1' },
      messageSent: { type: DataTypes.TEXT, allowNull: true },
      sentAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      outcome: { type: DataTypes.STRING(30), defaultValue: 'sent' },
      recipient: { type: DataTypes.STRING(255), allowNull: true },
      providerMessageId: { type: DataTypes.STRING(255), allowNull: true },
      error: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await safeAddIndex(queryInterface, 'OutreachLogs', ['userId', 'sentAt']);
    await safeAddIndex(queryInterface, 'OutreachLogs', ['userId', 'channel']);
    await safeAddIndex(queryInterface, 'OutreachLogs', ['userId', 'leadId']);

    // 7. UserSettings Table
    await safeCreateTable(queryInterface, 'UserSettings', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      timezone: { type: DataTypes.STRING(50), defaultValue: 'Asia/Dubai' },
      dailyEmailTarget: { type: DataTypes.INTEGER, defaultValue: 30 },
      dailyWhatsappTarget: { type: DataTypes.INTEGER, defaultValue: 30 },
      dailyCallTarget: { type: DataTypes.INTEGER, defaultValue: 20 },
      notifyTelegram: { type: DataTypes.BOOLEAN, defaultValue: true },
      notifyEmail: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await safeAddIndex(queryInterface, 'UserSettings', ['userId'], { unique: true });

    // Seed default call scripts
    const now = new Date();
    const defaultScripts = [
      {
        buyerType: 'designer',
        title: 'Interior Designer - Trade Partnership & Bespoke Sizing',
        scriptText: "Hi [Name], this is [Your Name] with Knotiq Rugs. I came across your recent interior projects and was really impressed with your aesthetic. We are direct manufacturers of handcrafted luxury rugs in India, supplying high-end design studios in Dubai and across the GCC with bespoke custom sizes, exact yarn-matching, and direct trade pricing without retail markups. Do you have 2 minutes to hear how we work with studios on project turnarounds?",
        objectionHandling: "If they say they already have a supplier: 'Totally understand. Most studios we partner with also have existing suppliers for stock pieces, but turn to us when they need unusual custom dimensions, 100% New Zealand wool or bamboo silk within 4-6 weeks without middleman premiums.'",
        tips: "Focus on bespoke flexibility, sample swatch kits, and rapid custom rendering in 48 hours.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'importer',
        title: 'Rug & Carpet Importer - Wholesale FOB / CIF Terms',
        scriptText: "Hello [Name], this is [Your Name] from Knotiq Rugs, direct rug weavers from Bhadohi, India. We are expanding our container shipment partnerships in your market. We specialize in hand-knotted 60-line to 120-line wool rugs and hand-tufted commercial lines with strict quality grading and fast sea-freight dispatch. Are you currently reviewing new manufacturing partners for upcoming seasonal stock?",
        objectionHandling: "If they ask for pricing immediately: 'Our standard 9x12 hand-tufted wool starts at competitive export FOB rates. I can send our wholesale container price sheet and export catalog to your email right now.'",
        tips: "Emphasize container FOB/CIF terms, production volume capacity, and strict pre-shipment inspection certificates.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'hotel',
        title: 'Hotel & Hospitality Procurement - FF&E Fire-Rated Specs',
        scriptText: "Good morning [Name], this is [Your Name] from Knotiq Rugs. We supply bespoke corridor runners, guest room area rugs, and presidential suite carpets for luxury hotels and resorts. Our rugs meet commercial hospitality wear ratings and fire-retardant standards. Who on your FF&E or procurement team manages guestroom carpet refurbishment specifications?",
        objectionHandling: "If passed to procurement receptionist: 'Could you confirm the best direct email for your Senior FF&E Project Manager so I can send our hospitality portfolio and project reference list?'",
        tips: "Mention durability specs, fire certification, anti-slip backing, and volume corridor runner weaving.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'retailer',
        title: 'Showroom & Retail Gallery - Consignment / Margin Pitch',
        scriptText: "Hello [Name], this is [Your Name] from Knotiq Rugs. We supply independent luxury furniture and rug showrooms with exclusive collections that aren't saturated on discount e-commerce sites. We offer high retail gross margins and complimentary sample display kits. Could I mail you our latest physical yarn pom box and catalog for your showroom floor?",
        objectionHandling: "If floor space is full: 'We offer a zero-inventory program where your clients can select from our ready-to-ship catalog and custom swatch box, giving you 50%+ margins without tying up floor capital.'",
        tips: "Emphasize high retail margins (45-60%), exclusive geographic patterns, and physical sample boxes.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'online_seller',
        title: 'E-commerce Brand / Marketplace Seller - Drop-ship & Rapid Restock',
        scriptText: "Hi [Name], reaching out from Knotiq Rugs. We manufacture rugs for established online home decor brands and Amazon/Noon sellers. We provide barcode labelling, single-piece drop-ship packing, and consistent 3-week batch restocking. Are you looking to improve your supplier margins or add high-ticket handmade wool rugs to your store?",
        objectionHandling: "If concerned about returns/breakage: 'Every rug is poly-tubed and heavy-duty wrapped with tamper-evident seals to ensure zero customer transit damage.'",
        tips: "Highlight drop-ship packaging, high-res lifestyle imagery, and standardized SKU barcodes.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'developer',
        title: 'Real Estate Developer & Fit-out Contractor - Turnkey Package',
        scriptText: "Hello [Name], this is [Your Name] with Knotiq Rugs. We work with turnkey fit-out contractors and luxury villa developers across the UAE, providing complete rug packages for show villas, luxury penthouses, and hospitality lobbies. We work directly off your AutoCAD and 3D render finishes. Who heads interior procurement for your active development projects?",
        objectionHandling: "If contractors say architects specify brands: 'We often serve as the approved manufacturing alternative that cuts client budgets by 25-30% while matching exact architect renderings.'",
        tips: "Focus on bill-of-quantities (BOQ) matching, CAD plan scaling, and tight handover deadlines.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'investor',
        title: 'Commercial Investor & Property Partner - Asset Staging',
        scriptText: "Hello [Name], [Your Name] from Knotiq Rugs. We partner with property investment firms and holiday home portfolios to stage premium luxury units with artisan carpets that elevate appraisal values and rental yield visuals. Would you be open to seeing our investor turnkey staging packages?",
        objectionHandling: "If they don't do furnishings directly: 'We work closely with your chosen operators to provide durable, high-yield furnishings that photograph exceptionally.'",
        tips: "Focus on ROI, property visual appraisal elevation, and durable rental-grade luxury.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      },
      {
        buyerType: 'homeowner',
        title: 'Bespoke Private Client - Custom Dream Rug Consultation',
        scriptText: "Hello [Name], thank you for your interest in Knotiq Rugs! I'm [Your Name], your bespoke rug consultant. Whether you have exact room measurements or color swatches from your curtains and sofa, our master artisans will handcraft your rug to perfection. What room or dimensions are you looking to design for your home?",
        objectionHandling: "If concerned about custom design complexity: 'We make it completely effortless: send us a photo of your living room, and our design team will render 3 custom carpet simulations in your exact colors within 24 hours at no cost.'",
        tips: "Be warm, highly consultative, ask about room dimensions and color palette, and offer complimentary design rendering.",
        isDefault: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    try {
      for (const script of defaultScripts) {
        const existing = await queryInterface.rawSelect(
          'CallScripts',
          { where: { buyerType: script.buyerType } },
          ['id']
        );
        if (!existing) {
          await queryInterface.bulkInsert('CallScripts', [script]);
        }
      }
    } catch (_) {
      // Non-blocking
    }
  },

  down: async (queryInterface) => {
    // Reversible if needed
  }
};
