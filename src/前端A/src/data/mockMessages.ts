import { OrderMessage } from '../types/message';

/**
 * Baseline Hackathon Mock Messages (10 original samples)
 */
export const INITIAL_MOCK_MESSAGES: OrderMessage[] = [
  {
    id: 'msg-101',
    source: 'whatsapp',
    sender: 'Sarah Jenkins',
    contact: '+1 (555) 234-8901',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 mins ago
    originalText:
      'Hi! Can I order 2 sourdough loaves and 4 chocolate croissants for pickup tomorrow at 10:00 AM? My name is Sarah Jenkins.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-1', name: 'Sourdough Loaf', quantity: 2, unitPrice: 7.5 },
        { id: 'item-2', name: 'Chocolate Croissant', quantity: 4, unitPrice: 4.25 },
      ],
      totalEstimate: 32.0,
      deliveryType: 'pickup',
      targetDateTime: 'Tomorrow 10:00 AM',
      confidenceScore: 96,
      analysisSummary: 'Detected 2 line items with clear quantities and pickup time.',
    },
  },
  {
    id: 'msg-102',
    source: 'email',
    sender: 'Marcus Vance (Apex Corp)',
    contact: 'marcus.v@apexcorp.internal',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    originalText:
      'Subject: Friday Team Lunch Catering Order\n\nHello OrderFlow Bakery,\nWe would like to place an order for our engineering sprint review this Friday. We need:\n- 12x Turkey & Avocado Baguette Sandwiches\n- 8x Roasted Veggie Hummus Wraps (Vegan)\n- 20x Fresh Fruit Cups\n\nPlease deliver to 742 Evergreen Blvd, 4th Floor Reception by 11:45 AM. Send the invoice to AP@apexcorp.com.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-1', name: 'Turkey & Avocado Baguette', quantity: 12, unitPrice: 11.5 },
        { id: 'item-2', name: 'Roasted Veggie Hummus Wrap (Vegan)', quantity: 8, unitPrice: 10.0 },
        { id: 'item-3', name: 'Fresh Fruit Cup', quantity: 20, unitPrice: 4.5 },
      ],
      totalEstimate: 308.0,
      deliveryType: 'delivery',
      deliveryAddress: '742 Evergreen Blvd, 4th Floor Reception',
      targetDateTime: 'Friday by 11:45 AM',
      customerNotes: 'Invoice AP@apexcorp.com',
      confidenceScore: 98,
      analysisSummary: 'High-confidence corporate catering order with 3 distinct items and delivery address.',
    },
  },
  {
    id: 'msg-103',
    source: 'whatsapp',
    sender: 'David Lin',
    contact: '+1 (555) 789-1234',
    timestamp: new Date(Date.now() - 1000 * 60 * 62).toISOString(), // ~1 hr ago
    originalText:
      'Hey OrderFlow team! Can you deliver 1x Iced Oat Matcha Latte, 2x Cold Brew with vanilla sweet cream, and 1x Cinnamon Swirl Muffin to 324 Maple Lane Apt 4B? ASAP please!',
    status: 'not_analyzed',
  },
  {
    id: 'msg-104',
    source: 'manual',
    sender: 'Phone Call - Mrs. Gable',
    contact: 'Call logged by Front Desk',
    timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(), // 1.5 hrs ago
    originalText:
      'Customer called: Wants 3 custom floral bouquets for an anniversary celebration on Thursday. Budget is loose ($60 - $90 each). She mentioned pastel colors, mostly peonies and eucalyptus, but will call back to confirm exact flower availability.',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-1', name: 'Custom Pastel Floral Bouquet (Peonies & Eucalyptus)', quantity: 3, unitPrice: 75.0 },
      ],
      totalEstimate: 225.0,
      deliveryType: 'pickup',
      targetDateTime: 'Thursday',
      customerNotes: 'Awaiting customer callback to finalize exact floral selection.',
      confidenceScore: 68,
      analysisSummary: 'Probable order detected, but exact items and total price require staff confirmation.',
    },
    reviewNotes: 'Customer will call back by 3 PM. Floral specialist needs to check peony inventory.',
  },
  {
    id: 'msg-105',
    source: 'whatsapp',
    sender: 'Elena Rostova',
    contact: '+1 (555) 432-1100',
    timestamp: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    originalText:
      'Hi there! Do you guys have gluten-free sourdough or gluten-free muffins available in stock this afternoon? Thanks!',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 94,
      analysisSummary: 'General menu inquiry regarding dietary options. No order quantities requested.',
    },
  },
  {
    id: 'msg-106',
    source: 'manual',
    sender: 'Walk-in Customer (Dave)',
    contact: 'Counter Tablet #2',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    originalText:
      'Counter pre-order: 5 bags of House Blend Whole Bean Coffee (12oz) and 2 reusable canvas tote bags. Customer paid deposit of $40 in cash.',
    status: 'not_analyzed',
  },
  {
    id: 'msg-107',
    source: 'email',
    sender: 'Stripe Billing Notifications',
    contact: 'notifications@stripe.internal',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    originalText:
      'Subject: Monthly merchant statement available for download\n\nYour monthly merchant statement for terminal account ending in 8891 is now available in your customer portal.',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 99,
      analysisSummary: 'Automated administrative notification / statement. Not an order request.',
    },
  },
  {
    id: 'msg-108',
    source: 'whatsapp',
    sender: 'Carlos Mendez',
    contact: '+1 (555) 901-3322',
    timestamp: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
    originalText:
      'Hello, I need to place an order for my company party: 30 assorted mini quiches, 15 smoked salmon bagels, and 2 carafes of hot coffee. However, my connection is poor, can you call me on this number to confirm payment?',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-1', name: 'Assorted Mini Quiches', quantity: 30, unitPrice: 2.5 },
        { id: 'item-2', name: 'Smoked Salmon Bagel', quantity: 15, unitPrice: 9.0 },
        { id: 'item-3', name: 'Hot Coffee Carafe', quantity: 2, unitPrice: 28.0 },
      ],
      totalEstimate: 266.0,
      confidenceScore: 78,
      analysisSummary: 'Items identified clearly, but customer requested callback for payment confirmation.',
    },
    reviewNotes: 'High value catering ($266). Call Carlos back to take deposit card over the phone.',
  },
  {
    id: 'msg-109',
    source: 'email',
    sender: 'Rachel Green',
    contact: 'rachel.g@studentcouncil.edu',
    timestamp: new Date(Date.now() - 1000 * 60 * 390).toISOString(),
    originalText:
      'Subject: University Club Meeting Snacks - Order for 40\n\nHello OrderFlow Bakery!\n\nWe would like to order 4 dozen chocolate chip cookies and 2 dozen blueberry scones for our Campus Hackathon kick-off on Wednesday at 3:00 PM.\n\nPlease deliver to Student Union Hall B, Room 204. Contact number on arrival is 555-883-9002.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-1', name: 'Chocolate Chip Cookies (Dozen)', quantity: 4, unitPrice: 18.0 },
        { id: 'item-2', name: 'Blueberry Scones (Dozen)', quantity: 2, unitPrice: 24.0 },
      ],
      totalEstimate: 120.0,
      deliveryType: 'delivery',
      deliveryAddress: 'Student Union Hall B, Room 204',
      targetDateTime: 'Wednesday 3:00 PM',
      customerNotes: 'Campus Hackathon kick-off. Contact on arrival: 555-883-9002',
      confidenceScore: 97,
      analysisSummary: 'Standard bakery dozen order with full delivery instructions and room number.',
    },
  },
  {
    id: 'msg-110',
    source: 'whatsapp',
    sender: 'Chloe Bennett',
    contact: '+1 (555) 667-4489',
    timestamp: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    originalText:
      'Hey just wanted to say thank you so much! The matcha cookies were incredible at our party yesterday. Everybody loved them!',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 96,
      analysisSummary: 'Customer compliment / thank you feedback message. No active order.',
    },
  },

  /* =======================================================================
   * 24 REALISTIC FULLY SYNTHETIC DEMO MESSAGES (TASK 1 EXPANSION)
   * Labeled as: [Synthetic Demo Data]
   * ======================================================================= */

  /* -----------------------------------------------------------------------
   * Category A: 6 Confirmed Orders (Status: 'recognized_as_order')
   * ----------------------------------------------------------------------- */
  {
    id: 'msg-synth-201',
    source: 'whatsapp',
    sender: 'Talia Rivera (Bloom Studio)',
    contact: '+1 (555) 312-9844',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    originalText:
      'Hi OrderFlow team! Can I please order 3 seasonal wildflower centerpieces in ceramic vases and 1 large dried eucalyptus bundle for pickup tomorrow at 4:30 PM? Total under Talia Rivera.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s1', name: 'Seasonal Wildflower Centerpiece (Ceramic Vase)', quantity: 3, unitPrice: 42.0 },
        { id: 'item-s2', name: 'Dried Eucalyptus Bundle (Large)', quantity: 1, unitPrice: 18.5 },
      ],
      totalEstimate: 144.5,
      deliveryType: 'pickup',
      targetDateTime: 'Tomorrow at 4:30 PM',
      confidenceScore: 96,
      analysisSummary: '[Synthetic Demo Data] High confidence floral preorder with explicit quantities and pickup window.',
    },
  },
  {
    id: 'msg-synth-202',
    source: 'email',
    sender: 'Dr. Kevin Sterling',
    contact: 'k.sterling@biotechlabs.example',
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(), // 1.25 hrs ago
    originalText:
      'Subject: Order for Lab Breakfast Meeting\n\nGood morning,\nWe would like to place an order for our weekly lab group meeting tomorrow morning:\n- 2x Premium Coffee Carafes (Dark Roast, 96oz each)\n- 10x Assorted Plain & Everything Bagels with Whipped Cream Cheese\n- 6x Parfait Cups with Greek Yogurt and Granola\n\nPlease deliver to 1400 Research Parkway, Suite 320 at 8:45 AM. Thank you, Kevin Sterling.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s3', name: 'Premium Coffee Carafe (Dark Roast, 96oz)', quantity: 2, unitPrice: 26.0 },
        { id: 'item-s4', name: 'Assorted Bagels with Cream Cheese', quantity: 10, unitPrice: 3.25 },
        { id: 'item-s5', name: 'Greek Yogurt Granola Parfait Cup', quantity: 6, unitPrice: 5.5 },
      ],
      totalEstimate: 117.5,
      deliveryType: 'delivery',
      deliveryAddress: '1400 Research Parkway, Suite 320',
      targetDateTime: 'Tomorrow morning at 8:45 AM',
      confidenceScore: 97,
      analysisSummary: '[Synthetic Demo Data] Corporate breakfast order with clear line items, time constraint, and suite address.',
    },
  },
  {
    id: 'msg-synth-203',
    source: 'whatsapp',
    sender: 'Devon Clarke',
    contact: '+1 (555) 782-4419',
    timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    originalText:
      'Hey guys, placing an order for tonight: 2x Signature Margherita Pizzas (thin crust), 1x Garlic Knots basket, and 2 cans of Italian sparkling blood orange soda. Delivery to 88 Riverside Dr, Apt 2C. Please leave at door.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s6', name: 'Signature Margherita Pizza (Thin Crust)', quantity: 2, unitPrice: 19.0 },
        { id: 'item-s7', name: 'Garlic Knots Basket', quantity: 1, unitPrice: 7.0 },
        { id: 'item-s8', name: 'Italian Blood Orange Soda (Can)', quantity: 2, unitPrice: 3.5 },
      ],
      totalEstimate: 52.0,
      deliveryType: 'delivery',
      deliveryAddress: '88 Riverside Dr, Apt 2C',
      customerNotes: 'Please leave at door',
      targetDateTime: 'Tonight',
      confidenceScore: 95,
      analysisSummary: '[Synthetic Demo Data] Direct dinner order with explicit items, delivery apartment, and drop-off instruction.',
    },
  },
  {
    id: 'msg-synth-204',
    source: 'email',
    sender: 'Hannah Becker (Craft & Clay Society)',
    contact: 'hannah@potteryclub.org',
    timestamp: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    originalText:
      'Subject: Order for Studio Exhibition Materials\n\nHello OrderFlow Crafts,\nWe are ready to order our studio exhibition setup:\n- 4x Handcrafted Ceramic Display Pedestals (White matte finish, $45.00 each)\n- 12x Artisanal Stoneware Espresso Cups ($14.00 each)\n\nWe will pick this up on Saturday at 11:00 AM. Please charge the card ending in 4109 on our wholesale account.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s9', name: 'Handcrafted Ceramic Display Pedestal (White Matte)', quantity: 4, unitPrice: 45.0 },
        { id: 'item-s10', name: 'Artisanal Stoneware Espresso Cup', quantity: 12, unitPrice: 14.0 },
      ],
      totalEstimate: 348.0,
      deliveryType: 'pickup',
      targetDateTime: 'Saturday at 11:00 AM',
      customerNotes: 'Wholesale account card ending 4109',
      confidenceScore: 98,
      analysisSummary: '[Synthetic Demo Data] Wholesale studio craft order with line item quantities and payment account reference.',
    },
  },
  {
    id: 'msg-synth-205',
    source: 'whatsapp',
    sender: 'Siddharth Rao',
    contact: '+1 (555) 604-8831',
    timestamp: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    originalText:
      'Can I order 1x Precision Tune-Up Service Package, 2x Continental Road Bike Inner Tubes (700x25c), and 1x Dry Chain Lube bottle? I will drop the bike off Wednesday at 9am.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s11', name: 'Precision Tune-Up Service Package', quantity: 1, unitPrice: 85.0 },
        { id: 'item-s12', name: 'Continental Road Bike Inner Tube (700x25c)', quantity: 2, unitPrice: 9.5 },
        { id: 'item-s13', name: 'Dry Chain Lube (4oz)', quantity: 1, unitPrice: 12.0 },
      ],
      totalEstimate: 116.0,
      deliveryType: 'pickup',
      targetDateTime: 'Wednesday at 9:00 AM drop-off',
      confidenceScore: 95,
      analysisSummary: '[Synthetic Demo Data] Service booking and bicycle components preorder with drop-off time.',
    },
  },
  {
    id: 'msg-synth-206',
    source: 'email',
    sender: 'Megan Gallagher',
    contact: 'megan.g@cityevents.org',
    timestamp: new Date(Date.now() - 1000 * 60 * 270).toISOString(),
    originalText:
      'Subject: Order: Custom Screenprinted Tote Bags (Qty 75)\n\nHi OrderFlow Print Shop,\nWe approve Proof #3. Please proceed with our order of 75 Heavyweight Organic Canvas Totes printed with the 2-color City Run logo on the front.\n\nDeliver to City Hall Annex, Loading Bay 2 by October 27th. Agreed quote: $487.50 inclusive of setup fee.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s14', name: 'Heavyweight Organic Canvas Tote (2-Color Screenprint)', quantity: 75, unitPrice: 6.5 },
      ],
      totalEstimate: 487.5,
      deliveryType: 'delivery',
      deliveryAddress: 'City Hall Annex, Loading Bay 2',
      targetDateTime: 'By October 27th',
      confidenceScore: 99,
      analysisSummary: '[Synthetic Demo Data] Commercial print production run confirmed with proof approval reference and loading bay address.',
    },
  },

  /* -----------------------------------------------------------------------
   * Category B: 4 Inquiries & Quotes (Status: 'not_an_order')
   * ----------------------------------------------------------------------- */
  {
    id: 'msg-synth-207',
    source: 'whatsapp',
    sender: 'Lucas Miller',
    contact: '+1 (555) 912-3044',
    timestamp: new Date(Date.now() - 1000 * 60 * 330).toISOString(),
    originalText:
      'Hi! Do you offer bulk discounts if our soccer team orders 35 custom printed hoodies next month? Also what is your typical turnaround time?',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 95,
      analysisSummary: '[Synthetic Demo Data] Commercial inquiry regarding bulk pricing and production turnaround. No confirmed order placed.',
    },
  },
  {
    id: 'msg-synth-208',
    source: 'email',
    sender: 'Julianne Vance (Wedding Coordinator)',
    contact: 'julianne@vanceweddings.example',
    timestamp: new Date(Date.now() - 1000 * 60 * 370).toISOString(),
    originalText:
      'Subject: Quote Request: Floral Archway & Table Arrangements for Fall Wedding\n\nDear Floral Team,\nI am planning a wedding reception for November 14th with approximately 120 guests. Could you send me your pricing brochure for ceremony archways and 14 low table centerpieces? We would like to schedule a consultation call next week.',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 97,
      analysisSummary: '[Synthetic Demo Data] Wedding floral quote and catalog request. Consultation requested without order confirmation.',
    },
  },
  {
    id: 'msg-synth-209',
    source: 'whatsapp',
    sender: 'Amara Okafor',
    contact: '+1 (555) 478-2211',
    timestamp: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    originalText:
      'Hello, are your gluten-free scones baked in a dedicated certified gluten-free kitchen? My daughter has a severe celiac allergy and I wanted to check safety before considering ordering.',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 96,
      analysisSummary: '[Synthetic Demo Data] Allergen and cross-contamination safety inquiry. No order placed.',
    },
  },
  {
    id: 'msg-synth-210',
    source: 'email',
    sender: 'Derrick Wong',
    contact: 'd.wong@metrorunners.club',
    timestamp: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    originalText:
      'Subject: Inquiry regarding custom race bibs and finisher medals\n\nHi,\nOur running club is organizing a 10K race in the spring. Do you manufacture custom Tyvek race bibs and die-cast medals? If so, could you share minimum order quantities and price estimates?',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 94,
      analysisSummary: '[Synthetic Demo Data] Product availability inquiry and MOQ request for future sporting event.',
    },
  },

  /* -----------------------------------------------------------------------
   * Category C: 4 Incomplete & Ambiguous Orders (Status: 'needs_human_review')
   * ----------------------------------------------------------------------- */
  {
    id: 'msg-synth-211',
    source: 'whatsapp',
    sender: 'Brianna Scott',
    contact: '+1 (555) 833-1902',
    timestamp: new Date(Date.now() - 1000 * 60 * 530).toISOString(),
    originalText:
      'Hey! Can you put together a birthday box for my sister this Saturday? She loves pastries and chocolate, maybe a cake too if you have something for 8-10 people. Budget is around $50-$70. Let me know what you can do!',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-s15', name: 'Custom Birthday Pastry & Cake Box', quantity: 1, unitPrice: 60.0 },
      ],
      totalEstimate: 60.0,
      deliveryType: 'pickup',
      targetDateTime: 'Saturday',
      confidenceScore: 68,
      analysisSummary: '[Synthetic Demo Data] Incomplete order request. Target items, exact cake size, and flavors are unspecified.',
    },
    reviewNotes: 'Customer needs to pick specific cake flavor and confirm exact pickup time.',
  },
  {
    id: 'msg-synth-212',
    source: 'email',
    sender: 'Robert Hayes (Horizon Tech)',
    contact: 'rhayes@horizontech.internal',
    timestamp: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    originalText:
      'Subject: Lunch Catering for Team\n\nHi,\nPlease prepare sandwich boxes and cold drinks for our client meeting on Thursday noon. Charge to our corporate card. Address is 500 Market St.',
    status: 'needs_human_review',
    parsedData: {
      items: [],
      deliveryType: 'delivery',
      deliveryAddress: '500 Market St',
      targetDateTime: 'Thursday noon',
      confidenceScore: 62,
      analysisSummary: '[Synthetic Demo Data] Incomplete order. Number of attendees, sandwich varieties, dietary restrictions, and suite number missing.',
    },
    reviewNotes: 'URGENT: Reply to Robert to ask for head count and floor/suite number.',
  },
  {
    id: 'msg-synth-213',
    source: 'whatsapp',
    sender: 'Nadia Petrov',
    contact: '+1 (555) 299-4780',
    timestamp: new Date(Date.now() - 1000 * 60 * 660).toISOString(),
    originalText:
      'I want to buy 2 of the handmade ceramic coffee mugs from your Instagram story from yesterday. But only if you still have them in the sage green glaze, not the terracotta one. Can you hold them for me?',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-s16', name: 'Handmade Ceramic Coffee Mug (Sage Green)', quantity: 2, unitPrice: 22.0 },
      ],
      totalEstimate: 44.0,
      confidenceScore: 71,
      analysisSummary: '[Synthetic Demo Data] Conditional order requiring immediate inventory check on sage green glaze stock.',
    },
    reviewNotes: 'Check retail shelf for remaining 2 sage green mugs before confirming hold.',
  },
  {
    id: 'msg-synth-214',
    source: 'email',
    sender: 'Grace Kim',
    contact: 'grace.kim@designcollective.io',
    timestamp: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    originalText:
      'Subject: Order of embroidered caps for staff - logo pending\n\nHello OrderFlow Print,\nWe want to order 40 black dad hats with white embroidery for our studio team. However, our creative director is updating the font kerning today. Can we lock in the production slot and send the final vector art tomorrow?',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-s17', name: 'Embroidered Cotton Dad Hat (Black)', quantity: 40, unitPrice: 15.0 },
      ],
      totalEstimate: 600.0,
      confidenceScore: 74,
      analysisSummary: '[Synthetic Demo Data] Order intent clear, but missing finalized vector artwork and delivery deadline confirmation.',
    },
    reviewNotes: 'Hold embroidery machine slot; wait for revised vector file before sending invoice.',
  },

  /* -----------------------------------------------------------------------
   * Category D: 4 Unrelated Conversations (Status: 'not_an_order')
   * ----------------------------------------------------------------------- */
  {
    id: 'msg-synth-215',
    source: 'whatsapp',
    sender: 'Wrong Number (Danielle)',
    contact: '+1 (555) 714-2399',
    timestamp: new Date(Date.now() - 1000 * 60 * 780).toISOString(),
    originalText:
      'Hey grandma, did you leave your reading glasses in my car yesterday? Let me know and I can drop them off after work.',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 99,
      analysisSummary: '[Synthetic Demo Data] Personal text message sent to business number by mistake. No business or order intent.',
    },
  },
  {
    id: 'msg-synth-216',
    source: 'email',
    sender: 'Sophie Laurent (Applicant)',
    contact: 'sophie.laurent.career@example.com',
    timestamp: new Date(Date.now() - 1000 * 60 * 850).toISOString(),
    originalText:
      'Subject: Application: Part-Time Barista / Operations Associate - Sophie Laurent\n\nDear Store Manager,\nI am writing to express my strong interest in the weekend barista position posted on your shop window. I have 3 years of specialty coffee experience and food handler certification. My resume is attached for your review.',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 99,
      analysisSummary: '[Synthetic Demo Data] Employment application with resume submission. Completely unrelated to customer orders.',
    },
  },
  {
    id: 'msg-synth-217',
    source: 'whatsapp',
    sender: 'Mateo Rossi',
    contact: '+1 (555) 880-9123',
    timestamp: new Date(Date.now() - 1000 * 60 * 920).toISOString(),
    originalText:
      'Just wanted to drop a note saying the wedding cake you made for my sister on Saturday was the absolute highlight of the evening! Everyone kept asking where we got it. 10/10 service!',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 98,
      analysisSummary: '[Synthetic Demo Data] Customer appreciation feedback and review compliment. No active purchase or request.',
    },
  },
  {
    id: 'msg-synth-218',
    source: 'email',
    sender: 'GrowthLeads AI Marketing',
    contact: 'outreach@growthleads-partner.info',
    timestamp: new Date(Date.now() - 1000 * 60 * 990).toISOString(),
    originalText:
      'Subject: Quick question regarding your local merchant search rankings\n\nHi OrderFlow Business Owner,\nWe noticed your business listing is currently not ranking in the top 3 map results for local searches in your neighborhood. Would you be open to a 10-minute audit call this Thursday?',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 99,
      analysisSummary: '[Synthetic Demo Data] Cold B2B sales solicitation and promotional spam. Zero order relevance.',
    },
  },

  /* -----------------------------------------------------------------------
   * Category E: 3 Order Modifications & Cancellations (Status: 'needs_human_review')
   * ----------------------------------------------------------------------- */
  {
    id: 'msg-synth-219',
    source: 'whatsapp',
    sender: 'Sarah Jenkins',
    contact: '+1 (555) 234-8901',
    timestamp: new Date(Date.now() - 1000 * 60 * 1050).toISOString(),
    originalText:
      'Hi! Regarding my order from earlier (Sarah Jenkins, 2 sourdough loaves and 4 chocolate croissants): Could I please change pickup time from 10:00 AM to 1:30 PM? Also could we swap 2 of the croissants for almond croissants if available?',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-mod1', name: 'Sourdough Loaf', quantity: 2, unitPrice: 7.5 },
        { id: 'item-mod2', name: 'Chocolate Croissant', quantity: 2, unitPrice: 4.25 },
        { id: 'item-mod3', name: 'Almond Croissant (Requested Swap)', quantity: 2, unitPrice: 4.5 },
      ],
      totalEstimate: 32.5,
      deliveryType: 'pickup',
      targetDateTime: 'Tomorrow 1:30 PM (Modified from 10:00 AM)',
      confidenceScore: 82,
      analysisSummary: '[Synthetic Demo Data] Order modification request modifying item selection and pickup time for existing order #msg-101.',
    },
    reviewNotes: 'Modify preparation schedule for msg-101: swap 2 chocolate croissants for almond and update pickup time to 1:30 PM.',
  },
  {
    id: 'msg-synth-220',
    source: 'email',
    sender: 'Marcus Vance (Apex Corp)',
    contact: 'marcus.v@apexcorp.internal',
    timestamp: new Date(Date.now() - 1000 * 60 * 1120).toISOString(),
    originalText:
      'Subject: URGENT CANCELLATION: Friday Team Lunch Catering Order\n\nHello OrderFlow Bakery,\nOur VP just notified us that our engineering on-site for this Friday has been moved entirely to remote due to travel disruptions. We must cancel our catering order (Order #msg-102: 12 baguettes, 8 wraps, 20 fruit cups).\n\nPlease confirm cancellation and that our company card has not been billed. We apologize for the short notice.',
    status: 'needs_human_review',
    parsedData: {
      items: [],
      confidenceScore: 92,
      analysisSummary: '[Synthetic Demo Data] Explicit cancellation request for existing corporate catering order #msg-102.',
    },
    reviewNotes: 'CANCELLATION REQUEST for msg-102 ($308.00). Cancel kitchen prep ticket and ensure no charge was processed.',
  },
  {
    id: 'msg-synth-221',
    source: 'whatsapp',
    sender: 'Rachel Green',
    contact: '555-883-9002',
    timestamp: new Date(Date.now() - 1000 * 60 * 1180).toISOString(),
    originalText:
      'Hi! Regarding our student council cookie & scone order for Wednesday (msg-109): Could you also add 3 gallons of cold brew iced coffee with oat milk and cups? Please add the extra charge to our invoice.',
    status: 'needs_human_review',
    parsedData: {
      items: [
        { id: 'item-mod4', name: 'Cold Brew Iced Coffee (Gallon with Oat Milk & Cups)', quantity: 3, unitPrice: 28.0 },
      ],
      totalEstimate: 84.0,
      deliveryType: 'delivery',
      deliveryAddress: 'Student Union Hall B, Room 204',
      targetDateTime: 'Wednesday 3:00 PM',
      confidenceScore: 85,
      analysisSummary: '[Synthetic Demo Data] Add-on order modification adding beverage line items to existing delivery #msg-109.',
    },
    reviewNotes: 'Add $84.00 beverage add-on to Rachel Green order msg-109. Prepare 3 cold brew gallons for Wednesday 3:00 PM.',
  },

  /* -----------------------------------------------------------------------
   * Category F: 3 Email Invoice / Order Notifications
   * ----------------------------------------------------------------------- */
  {
    id: 'msg-synth-222',
    source: 'email',
    sender: 'Pacific Coast Roasters B2B',
    contact: 'billing@pacificroasters.supply',
    timestamp: new Date(Date.now() - 1000 * 60 * 1250).toISOString(),
    originalText:
      'Subject: Supplier Invoice #INV-49210: Green Coffee Beans & Compostable Bags (Due in 15 days)\n\nDear Merchant,\nThank you for your supply order. Attached is Invoice #INV-49210 for $640.00 covering:\n- 4x 50lb Colombian Supremo Green Beans\n- 1,000x 12oz Kraft Compostable Coffee Pouches\n\nShipment departed warehouse via Freight Express (Tracking #FX-982103).',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 97,
      analysisSummary: '[Synthetic Demo Data] Upstream supplier invoice and B2B raw materials billing notification. Not a customer order.',
    },
  },
  {
    id: 'msg-synth-223',
    source: 'email',
    sender: 'Shopify Store Notifications',
    contact: 'mailer@shopify.internal',
    timestamp: new Date(Date.now() - 1000 * 60 * 1320).toISOString(),
    originalText:
      'Subject: [OrderFlow Online Store] New Order #1142 confirmed from Liam Henderson ($84.50)\n\nYou received a new order from your web storefront:\n- 1x Hand-carved Walnut Cutting Board ($54.00)\n- 1x Mineral Oil & Beeswax Conditioning Wax ($12.50)\n- Standard Flat Rate Shipping ($18.00)\n\nShip to: Liam Henderson, 1420 Pinecrest Terrace, Seattle, WA 98101.\nPayment confirmed via Apple Pay.',
    status: 'recognized_as_order',
    parsedData: {
      items: [
        { id: 'item-s18', name: 'Hand-carved Walnut Cutting Board', quantity: 1, unitPrice: 54.0 },
        { id: 'item-s19', name: 'Mineral Oil & Beeswax Conditioning Wax', quantity: 1, unitPrice: 12.5 },
      ],
      totalEstimate: 84.5,
      deliveryType: 'delivery',
      deliveryAddress: '1420 Pinecrest Terrace, Seattle, WA 98101',
      customerNotes: 'E-commerce automated store order (Apple Pay verified)',
      confidenceScore: 99,
      analysisSummary: '[Synthetic Demo Data] Automated online store order notification requiring shipment fulfillment.',
    },
  },
  {
    id: 'msg-synth-224',
    source: 'email',
    sender: 'FedEx Shipping Tracking',
    contact: 'trackingupdates@fedex.internal',
    timestamp: new Date(Date.now() - 1000 * 60 * 1400).toISOString(),
    originalText:
      'Subject: FedEx Shipment Delivered: Tracking #783920119284\n\nYour shipment from Artisan Bakery Equipment Co. was delivered today at 1:45 PM to Front Reception. Signed for by: M. JOHNSON.',
    status: 'not_an_order',
    parsedData: {
      items: [],
      confidenceScore: 99,
      analysisSummary: '[Synthetic Demo Data] Automated carrier package delivery confirmation notification. Not a customer order.',
    },
  },
];
