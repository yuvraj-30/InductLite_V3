import {
  PrismaClient,
  UserRole,
  QuestionType,
  VisitorType,
  DocumentType,
} from "@prisma/client";
import * as argon2 from "argon2";
import { subDays, subHours, addMonths, subMonths } from "date-fns";

/* eslint-disable no-console */
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Get admin password from env or use default for dev
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // =========================================================================
  // COMPANY
  // =========================================================================
  console.log("📦 Creating company...");
  const company = await prisma.company.upsert({
    where: { slug: "buildright-nz" },
    update: {},
    create: {
      name: "BuildRight NZ",
      slug: "buildright-nz",
      retention_days: 365,
    },
  });
  console.log(`   ✓ Company: ${company.name} (${company.id})`);

  // =========================================================================
  // ADMIN USER
  // =========================================================================
  console.log("👤 Creating admin user...");
  const admin = await prisma.user.upsert({
    where: { email: "admin@buildright.co.nz" },
    update: { password_hash: passwordHash },
    create: {
      company_id: company.id,
      email: "admin@buildright.co.nz",
      password_hash: passwordHash,
      name: "Admin User",
      role: UserRole.ADMIN,
      is_active: true,
    },
  });
  console.log(`   ✓ Admin: ${admin.email}`);

  // Also create a viewer user for testing RBAC
  const viewer = await prisma.user.upsert({
    where: { email: "viewer@buildright.co.nz" },
    update: {},
    create: {
      company_id: company.id,
      email: "viewer@buildright.co.nz",
      password_hash: passwordHash,
      name: "Viewer User",
      role: UserRole.VIEWER,
      is_active: true,
    },
  });
  console.log(`   ✓ Viewer: ${viewer.email}`);

  // =========================================================================
  // SITES
  // =========================================================================
  console.log("🏗️ Creating sites...");
  const site1 = await prisma.site.upsert({
    where: {
      company_id_name: {
        company_id: company.id,
        name: "Auckland Central Office Tower",
      },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "Auckland Central Office Tower",
      address: "123 Queen Street, Auckland CBD, 1010",
      description: "High-rise commercial office construction project",
      is_active: true,
    },
  });

  const site2 = await prisma.site.upsert({
    where: {
      company_id_name: {
        company_id: company.id,
        name: "Wellington Harbour Apartments",
      },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "Wellington Harbour Apartments",
      address: "45 Waterloo Quay, Wellington, 6011",
      description: "Residential apartment complex renovation",
      is_active: true,
    },
  });
  // Test site for E2E tests
  const testSite = await prisma.site.upsert({
    where: {
      company_id_name: {
        company_id: company.id,
        name: "Test Site",
      },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "Test Site",
      address: "123 Test Street, Test City, 1234",
      description: "Site for E2E testing",
      is_active: true,
    },
  });

  console.log(`   ✓ Site 1: ${site1.name}`);
  console.log(`   ✓ Site 2: ${site2.name}`);
  console.log(`   ✓ Test Site: ${testSite.name}`);

  // =========================================================================
  // PUBLIC LINKS (QR Codes)
  // =========================================================================
  console.log("🔗 Creating public links...");
  const link1 = await prisma.sitePublicLink.upsert({
    where: { slug: "auckland-tower" },
    update: {},
    create: {
      site_id: site1.id,
      slug: "auckland-tower",
      is_active: true,
    },
  });

  const link2 = await prisma.sitePublicLink.upsert({
    where: { slug: "wellington-harbour" },
    update: {},
    create: {
      site_id: site2.id,
      slug: "wellington-harbour",
      is_active: true,
    },
  });
  const testLink = await prisma.sitePublicLink.upsert({
    where: { slug: "test-site" },
    update: {},
    create: {
      site_id: testSite.id,
      slug: "test-site",
      is_active: true,
    },
  });

  console.log(`   ✓ Public link: /s/${link1.slug}`);
  console.log(`   ✓ Public link: /s/${link2.slug}`);
  console.log(`   ✓ Public link: /s/${testLink.slug}`);

  // =========================================================================
  // INDUCTION TEMPLATES
  // =========================================================================
  console.log("📋 Creating induction templates...");

  // Company-wide default template
  const defaultTemplate = await prisma.inductionTemplate.upsert({
    where: {
      company_id_name_version: {
        company_id: company.id,
        name: "General Site Safety Induction",
        version: 1,
      },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "General Site Safety Induction",
      description: "Standard safety induction for all BuildRight NZ sites",
      version: 1,
      is_published: true,
      is_default: true,
      published_at: new Date(),
    },
  });

  // Add questions to default template
  const defaultQuestions = [
    {
      text: "I have read and understood the site safety rules",
      type: QuestionType.ACKNOWLEDGMENT,
      order: 1,
    },
    {
      text: "I will wear appropriate PPE at all times while on site",
      type: QuestionType.ACKNOWLEDGMENT,
      order: 2,
    },
    {
      text: "What type of PPE is required on this site?",
      type: QuestionType.MULTIPLE_CHOICE,
      order: 3,
      options: [
        "Hard hat only",
        "Hard hat and high-vis vest",
        "Hard hat, high-vis vest, and safety boots",
        "No PPE required",
      ],
      correct: "Hard hat, high-vis vest, and safety boots",
    },
    {
      text: "In case of emergency, I will proceed to the designated assembly point",
      type: QuestionType.YES_NO,
      order: 4,
    },
    {
      text: "Do you have any medical conditions we should be aware of?",
      type: QuestionType.TEXT,
      order: 5,
      required: false,
    },
    {
      text: "I understand I must report all incidents and near-misses",
      type: QuestionType.ACKNOWLEDGMENT,
      order: 6,
    },
  ];

  for (const q of defaultQuestions) {
    await prisma.inductionQuestion.upsert({
      where: { id: `${defaultTemplate.id}-q${q.order}` },
      update: {},
      create: {
        id: `${defaultTemplate.id}-q${q.order}`,
        template_id: defaultTemplate.id,
        question_text: q.text,
        question_type: q.type,
        options: q.options ?? undefined,
        correct_answer: q.correct ? { answer: q.correct } : undefined,
        is_required: q.required !== false,
        display_order: q.order,
      },
    });
  }

  console.log(
    `   ✓ Default template: ${defaultTemplate.name} (${defaultQuestions.length} questions)`,
  );

  // Site-specific template for Auckland site
  const siteTemplate = await prisma.inductionTemplate.upsert({
    where: {
      company_id_name_version: {
        company_id: company.id,
        name: "Auckland Tower - High-Rise Safety",
        version: 1,
      },
    },
    update: {},
    create: {
      company_id: company.id,
      site_id: site1.id, // Assign to Auckland site
      name: "Auckland Tower - High-Rise Safety",
      description: "Additional safety requirements for high-rise construction",
      version: 1,
      is_published: true,
      is_default: false,
      published_at: new Date(),
    },
  });

  const siteQuestions = [
    {
      text: "I have completed fall protection training",
      type: QuestionType.YES_NO,
      order: 1,
    },
    {
      text: "I understand the crane operation exclusion zones",
      type: QuestionType.ACKNOWLEDGMENT,
      order: 2,
    },
    {
      text: "Which floors are currently active work zones?",
      type: QuestionType.CHECKBOX,
      order: 3,
      options: ["Ground floor", "Floors 1-5", "Floors 6-10", "Floors 11-15"],
    },
    {
      text: "I will use the designated personnel lift only",
      type: QuestionType.ACKNOWLEDGMENT,
      order: 4,
    },
  ];

  for (const q of siteQuestions) {
    await prisma.inductionQuestion.upsert({
      where: { id: `${siteTemplate.id}-q${q.order}` },
      update: {},
      create: {
        id: `${siteTemplate.id}-q${q.order}`,
        template_id: siteTemplate.id,
        question_text: q.text,
        question_type: q.type,
        options: q.options ?? undefined,
        is_required: true,
        display_order: q.order,
      },
    });
  }

  // Site template is already assigned via site_id field

  console.log(
    `   ✓ Site template: ${siteTemplate.name} (${siteQuestions.length} questions)`,
  );

  // =========================================================================
  // CONTRACTORS
  // =========================================================================
  console.log("🔧 Creating contractors...");

  const contractor1 = await prisma.contractor.upsert({
    where: {
      company_id_name: { company_id: company.id, name: "Spark Electrical Ltd" },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "Spark Electrical Ltd",
      contact_name: "John Sparks",
      contact_email: "john@sparkelectrical.co.nz",
      contact_phone: "+64 21 123 4567",
      trade: "Electrical",
      is_active: true,
    },
  });

  const contractor2 = await prisma.contractor.upsert({
    where: {
      company_id_name: {
        company_id: company.id,
        name: "Kiwi Plumbing Services",
      },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "Kiwi Plumbing Services",
      contact_name: "Sarah Waters",
      contact_email: "sarah@kiwiplumbing.co.nz",
      contact_phone: "+64 21 234 5678",
      trade: "Plumbing",
      is_active: true,
    },
  });

  const contractor3 = await prisma.contractor.upsert({
    where: {
      company_id_name: { company_id: company.id, name: "SafeScaffold NZ" },
    },
    update: {},
    create: {
      company_id: company.id,
      name: "SafeScaffold NZ",
      contact_name: "Mike Steel",
      contact_email: "mike@safescaffold.co.nz",
      contact_phone: "+64 21 345 6789",
      trade: "Scaffolding",
      is_active: true,
    },
  });

  console.log(`   ✓ Contractor: ${contractor1.name}`);
  console.log(`   ✓ Contractor: ${contractor2.name}`);
  console.log(`   ✓ Contractor: ${contractor3.name}`);

  // =========================================================================
  // CONTRACTOR DOCUMENTS (including one expired)
  // =========================================================================
  console.log("📄 Creating contractor documents...");

  // Valid documents
  await prisma.contractorDocument.upsert({
    where: { id: `${contractor1.id}-insurance` },
    update: {},
    create: {
      id: `${contractor1.id}-insurance`,
      contractor_id: contractor1.id,
      document_type: DocumentType.INSURANCE,
      file_name: "spark_electrical_insurance_2024.pdf",
      file_path: "contractors/spark-electrical/insurance_2024.pdf",
      file_size: 245000,
      mime_type: "application/pdf",
      expires_at: addMonths(new Date(), 6),
    },
  });

  await prisma.contractorDocument.upsert({
    where: { id: `${contractor1.id}-license` },
    update: {},
    create: {
      id: `${contractor1.id}-license`,
      contractor_id: contractor1.id,
      document_type: DocumentType.LICENSE,
      file_name: "electrical_license.pdf",
      file_path: "contractors/spark-electrical/license.pdf",
      file_size: 125000,
      mime_type: "application/pdf",
      expires_at: addMonths(new Date(), 12),
    },
  });

  await prisma.contractorDocument.upsert({
    where: { id: `${contractor2.id}-insurance` },
    update: {},
    create: {
      id: `${contractor2.id}-insurance`,
      contractor_id: contractor2.id,
      document_type: DocumentType.INSURANCE,
      file_name: "kiwi_plumbing_insurance.pdf",
      file_path: "contractors/kiwi-plumbing/insurance.pdf",
      file_size: 198000,
      mime_type: "application/pdf",
      expires_at: addMonths(new Date(), 3),
    },
  });

  // EXPIRED document
  await prisma.contractorDocument.upsert({
    where: { id: `${contractor3.id}-insurance-expired` },
    update: {},
    create: {
      id: `${contractor3.id}-insurance-expired`,
      contractor_id: contractor3.id,
      document_type: DocumentType.INSURANCE,
      file_name: "safescaffold_insurance_expired.pdf",
      file_path: "contractors/safescaffold/insurance_expired.pdf",
      file_size: 210000,
      mime_type: "application/pdf",
      expires_at: subMonths(new Date(), 1), // Expired 1 month ago
    },
  });

  // Valid certification for contractor 3
  await prisma.contractorDocument.upsert({
    where: { id: `${contractor3.id}-cert` },
    update: {},
    create: {
      id: `${contractor3.id}-cert`,
      contractor_id: contractor3.id,
      document_type: DocumentType.CERTIFICATION,
      file_name: "scaffolding_certification.pdf",
      file_path: "contractors/safescaffold/certification.pdf",
      file_size: 156000,
      mime_type: "application/pdf",
      expires_at: addMonths(new Date(), 8),
    },
  });

  console.log("   ✓ Created 5 contractor documents (1 expired)");

  // =========================================================================
  // SIGN-IN RECORDS (last 14 days, some active)
  // =========================================================================
  console.log("📝 Creating sign-in records...");

  const signInData = [
    // Active sign-ins (no sign_out_ts)
    {
      name: "Dave Builder",
      phone: "+64 21 111 2222",
      employer: "Spark Electrical Ltd",
      site: site1.id,
      daysAgo: 0,
      hoursAgo: 2,
      active: true,
    },
    {
      name: "Lisa Carpenter",
      phone: "+64 21 333 4444",
      employer: "Kiwi Plumbing Services",
      site: site1.id,
      daysAgo: 0,
      hoursAgo: 4,
      active: true,
    },
    {
      name: "Tom Welder",
      phone: "+64 21 555 6666",
      employer: "SafeScaffold NZ",
      site: site2.id,
      daysAgo: 0,
      hoursAgo: 1,
      active: true,
    },
    // Completed sign-ins
    {
      name: "Jane Engineer",
      phone: "+64 21 777 8888",
      employer: "Spark Electrical Ltd",
      site: site1.id,
      daysAgo: 1,
      hoursAgo: 8,
      active: false,
      duration: 6,
    },
    {
      name: "Bob Mason",
      phone: "+64 21 999 0000",
      employer: "Independent",
      site: site2.id,
      daysAgo: 2,
      hoursAgo: 9,
      active: false,
      duration: 4,
    },
    {
      name: "Emma Painter",
      phone: "+64 21 222 3333",
      employer: "Kiwi Plumbing Services",
      site: site1.id,
      daysAgo: 3,
      hoursAgo: 7,
      active: false,
      duration: 8,
    },
    {
      name: "Chris Roofer",
      phone: "+64 21 444 5555",
      employer: "SafeScaffold NZ",
      site: site2.id,
      daysAgo: 5,
      hoursAgo: 10,
      active: false,
      duration: 5,
    },
    {
      name: "Mia Tiler",
      phone: "+64 21 666 7777",
      employer: "Independent",
      site: site1.id,
      daysAgo: 7,
      hoursAgo: 8,
      active: false,
      duration: 7,
    },
    {
      name: "Nick Glazier",
      phone: "+64 21 888 9999",
      employer: "Spark Electrical Ltd",
      site: site2.id,
      daysAgo: 10,
      hoursAgo: 9,
      active: false,
      duration: 6,
    },
    {
      name: "Sophie Joiner",
      phone: "+64 21 000 1111",
      employer: "Independent",
      site: site1.id,
      daysAgo: 12,
      hoursAgo: 7,
      active: false,
      duration: 5,
    },
  ];

  let signInCount = 0;
  for (const s of signInData) {
    const signInTs = subHours(subDays(new Date(), s.daysAgo), s.hoursAgo);
    const signOutTs = s.active ? null : subHours(signInTs, -(s.duration || 4));

    const record = await prisma.signInRecord.create({
      data: {
        company_id: company.id,
        site_id: s.site,
        visitor_name: s.name,
        visitor_phone: s.phone,
        employer_name: s.employer,
        visitor_type: VisitorType.CONTRACTOR,
        sign_in_ts: signInTs,
        sign_out_ts: signOutTs,
      },
    });

    // Create induction response for each sign-in
    await prisma.inductionResponse.create({
      data: {
        sign_in_record_id: record.id,
        template_id: defaultTemplate.id,
        template_version: 1,
        answers: [
          { question_id: `${defaultTemplate.id}-q1`, answer: true },
          { question_id: `${defaultTemplate.id}-q2`, answer: true },
          {
            question_id: `${defaultTemplate.id}-q3`,
            answer: "Hard hat, high-vis vest, and safety boots",
          },
          { question_id: `${defaultTemplate.id}-q4`, answer: true },
          { question_id: `${defaultTemplate.id}-q5`, answer: "" },
          { question_id: `${defaultTemplate.id}-q6`, answer: true },
        ],
        passed: true,
        completed_at: signInTs,
      },
    });

    signInCount++;
  }

  console.log(
    `   ✓ Created ${signInCount} sign-in records (3 active, 7 completed)`,
  );

  // =========================================================================
  // AUDIT LOG ENTRIES
  // =========================================================================
  console.log("📊 Creating audit log entries...");

  await prisma.auditLog.createMany({
    data: [
      {
        company_id: company.id,
        user_id: admin.id,
        action: "user.login",
        details: { method: "email_password" },
        created_at: subDays(new Date(), 1),
      },
      {
        company_id: company.id,
        user_id: admin.id,
        action: "site.create",
        entity_type: "Site",
        entity_id: site1.id,
        details: { name: site1.name },
        created_at: subDays(new Date(), 7),
      },
      {
        company_id: company.id,
        user_id: admin.id,
        action: "site.create",
        entity_type: "Site",
        entity_id: site2.id,
        details: { name: site2.name },
        created_at: subDays(new Date(), 7),
      },
      {
        company_id: company.id,
        user_id: admin.id,
        action: "template.publish",
        entity_type: "InductionTemplate",
        entity_id: defaultTemplate.id,
        details: { name: defaultTemplate.name, version: 1 },
        created_at: subDays(new Date(), 5),
      },
    ],
  });

  console.log("   ✓ Created 4 audit log entries");

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n✅ Seed completed successfully!");
  console.log("─".repeat(50));
  console.log("📧 Admin login: admin@buildright.co.nz");
  console.log(`🔑 Password: ${adminPassword}`);
  console.log("─".repeat(50));
  console.log(`🏢 Company: ${company.name}`);
  console.log(`🏗️  Sites: 2`);
  console.log(`📋 Templates: 2 (1 default, 1 site-specific)`);
  console.log(`🔧 Contractors: 3`);
  console.log(`📄 Documents: 5 (1 expired)`);
  console.log(`📝 Sign-ins: ${signInCount} (3 currently on site)`);
  console.log("─".repeat(50));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
