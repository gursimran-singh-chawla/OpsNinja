import { hashPassword } from "../src/lib/password.js";
import { PrismaClient, WorkKind, TaskPriority, TaskCategory, VisibilityType, BoardColumn } from "@prisma/client";

const prisma = new PrismaClient();
const password = "Harborlane!26";

async function main() {
  console.log("Cleaning up existing database records...");
  await prisma.message.deleteMany();
  await prisma.mention.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskAccess.deleteMany();
  await prisma.task.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.featureFlag.deleteMany();

  console.log("Hashing default password...");
  const hash = await hashPassword(password);
  const verifiedAt = new Date();

  // -------------------------------------------------------------
  // 1. Users & Hierarchy
  // -------------------------------------------------------------
  console.log("Seeding platform users...");

  // Platform Admin
  const admin = await prisma.user.create({
    data: {
      email: "priya.nair@harborlane.example",
      name: "Priya Nair",
      role: "admin",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  // Leads
  const sarah = await prisma.user.create({
    data: {
      email: "sarah.okonkwo@harborlane.example",
      name: "Sarah Okonkwo",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const noah = await prisma.user.create({
    data: {
      email: "noah.kim@harborlane.example",
      name: "Noah Kim",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const elena = await prisma.user.create({
    data: {
      email: "elena.rossi@harborlane.example",
      name: "Elena Rossi",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const jamal = await prisma.user.create({
    data: {
      email: "jamal.wright@harborlane.example",
      name: "Jamal Wright",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const priyaDesai = await prisma.user.create({
    data: {
      email: "priya.desai@harborlane.example",
      name: "Priya Desai",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const david = await prisma.user.create({
    data: {
      email: "david.vance@harborlane.example",
      name: "David Vance",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const rebecca = await prisma.user.create({
    data: {
      email: "rebecca.thorn@harborlane.example",
      name: "Rebecca Thorn",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const marcusSterling = await prisma.user.create({
    data: {
      email: "marcus.sterling@harborlane.example",
      name: "Marcus Sterling",
      role: "lead",
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const leads = [sarah, noah, elena, jamal, priyaDesai, david, rebecca, marcusSterling];

  // Managers
  const marcus = await prisma.user.create({
    data: {
      email: "marcus.hale@harborlane.example",
      name: "Marcus Hale",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const lena = await prisma.user.create({
    data: {
      email: "lena.vogel@harborlane.example",
      name: "Lena Vogel",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const chris = await prisma.user.create({
    data: {
      email: "chris.dalton@harborlane.example",
      name: "Chris Dalton",
      role: "manager",
      reportsToId: noah.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const maya = await prisma.user.create({
    data: {
      email: "maya.chen@harborlane.example",
      name: "Maya Chen",
      role: "manager",
      reportsToId: noah.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const owen = await prisma.user.create({
    data: {
      email: "owen.blake@harborlane.example",
      name: "Owen Blake",
      role: "manager",
      reportsToId: elena.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const sofia = await prisma.user.create({
    data: {
      email: "sofia.alvarez@harborlane.example",
      name: "Sofia Alvarez",
      role: "manager",
      reportsToId: elena.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const ben = await prisma.user.create({
    data: {
      email: "ben.okoye@harborlane.example",
      name: "Ben Okoye",
      role: "manager",
      reportsToId: jamal.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const hannah = await prisma.user.create({
    data: {
      email: "hannah.lee@harborlane.example",
      name: "Hannah Lee",
      role: "manager",
      reportsToId: jamal.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const tomas = await prisma.user.create({
    data: {
      email: "tomas.silva@harborlane.example",
      name: "Tomás Silva",
      role: "manager",
      reportsToId: priyaDesai.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const aisha = await prisma.user.create({
    data: {
      email: "aisha.rahman@harborlane.example",
      name: "Aisha Rahman",
      role: "manager",
      reportsToId: priyaDesai.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const greg = await prisma.user.create({
    data: {
      email: "greg.walsh@harborlane.example",
      name: "Greg Walsh",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const nina = await prisma.user.create({
    data: {
      email: "nina.patel@harborlane.example",
      name: "Nina Patel",
      role: "manager",
      reportsToId: noah.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const leo = await prisma.user.create({
    data: {
      email: "leo.nakamura@harborlane.example",
      name: "Leo Nakamura",
      role: "manager",
      reportsToId: elena.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const claire = await prisma.user.create({
    data: {
      email: "claire.dubois@harborlane.example",
      name: "Claire Dubois",
      role: "manager",
      reportsToId: jamal.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const samir = await prisma.user.create({
    data: {
      email: "samir.haddad@harborlane.example",
      name: "Samir Haddad",
      role: "manager",
      reportsToId: priyaDesai.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const liam = await prisma.user.create({
    data: {
      email: "liam.gallagher@harborlane.example",
      name: "Liam Gallagher",
      role: "manager",
      reportsToId: david.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const sunita = await prisma.user.create({
    data: {
      email: "sunita.rao@harborlane.example",
      name: "Sunita Rao",
      role: "manager",
      reportsToId: david.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const julian = await prisma.user.create({
    data: {
      email: "julian.croft@harborlane.example",
      name: "Julian Croft",
      role: "manager",
      reportsToId: rebecca.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const kendra = await prisma.user.create({
    data: {
      email: "kendra.brooks@harborlane.example",
      name: "Kendra Brooks",
      role: "manager",
      reportsToId: rebecca.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const ethan = await prisma.user.create({
    data: {
      email: "ethan.hunt@harborlane.example",
      name: "Ethan Hunt",
      role: "manager",
      reportsToId: marcusSterling.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const managers = [
    marcus, lena, chris, maya, owen, sofia, ben, hannah, tomas, aisha, greg, nina, leo, claire, samir,
    liam, sunita, julian, kendra, ethan,
  ];

  // Core Associates
  const ravi = await prisma.user.create({
    data: {
      email: "ravi.mehta@harborlane.example",
      name: "Ravi Mehta",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const june = await prisma.user.create({
    data: {
      email: "june.park@harborlane.example",
      name: "June Park",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const tara = await prisma.user.create({
    data: {
      email: "tara.singh@harborlane.example",
      name: "Tara Singh",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const dio = await prisma.user.create({
    data: {
      email: "dio.santos@harborlane.example",
      name: "Dio Santos",
      role: "associate",
      reportsToId: lena.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const luis = await prisma.user.create({
    data: {
      email: "luis.ortega@harborlane.example",
      name: "Luis Ortega",
      role: "associate",
      reportsToId: lena.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const emma = await prisma.user.create({
    data: {
      email: "emma.brooks@harborlane.example",
      name: "Emma Brooks",
      role: "associate",
      reportsToId: lena.id,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  // Free Agents (reportsToId = null)
  const amira = await prisma.user.create({
    data: {
      email: "amira.hassan@harborlane.example",
      name: "Amira Hassan",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const lucas = await prisma.user.create({
    data: {
      email: "lucas.moreau@harborlane.example",
      name: "Lucas Moreau",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const priyaSen = await prisma.user.create({
    data: {
      email: "priya.sen@harborlane.example",
      name: "Priya Sen",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const alexTurner = await prisma.user.create({
    data: {
      email: "alex.turner@harborlane.example",
      name: "Alex Turner",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  const sophieChen = await prisma.user.create({
    data: {
      email: "sophie.chen@harborlane.example",
      name: "Sophie Chen",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
      emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
    },
  });

  // Additional Associates assigned across managers
  const extraAssociatesData = [
    { name: "Kai Nakamura", email: "kai.nakamura@harborlane.example", mgr: chris },
    { name: "Nora Feldman", email: "nora.feldman@harborlane.example", mgr: chris },
    { name: "Ibrahim Saleh", email: "ibrahim.saleh@harborlane.example", mgr: chris },
    { name: "Chloe Martin", email: "chloe.martin@harborlane.example", mgr: maya },
    { name: "Andre Cole", email: "andre.cole@harborlane.example", mgr: maya },
    { name: "Yuki Tanaka", email: "yuki.tanaka@harborlane.example", mgr: maya },
    { name: "Paula Mendes", email: "paula.mendes@harborlane.example", mgr: owen },
    { name: "Ryan Foster", email: "ryan.foster@harborlane.example", mgr: owen },
    { name: "Mei Lin", email: "mei.lin@harborlane.example", mgr: owen },
    { name: "Omar Farouk", email: "omar.farouk@harborlane.example", mgr: sofia },
    { name: "Grace Okafor", email: "grace.okafor@harborlane.example", mgr: sofia },
    { name: "Pavel Novak", email: "pavel.novak@harborlane.example", mgr: sofia },
    { name: "Jade Nguyen", email: "jade.nguyen@harborlane.example", mgr: ben },
    { name: "Seth Cohen", email: "seth.cohen@harborlane.example", mgr: ben },
    { name: "Ines Moreau", email: "ines.moreau@harborlane.example", mgr: ben },
    { name: "Diego Vargas", email: "diego.vargas@harborlane.example", mgr: hannah },
    { name: "Lila Shah", email: "lila.shah@harborlane.example", mgr: hannah },
    { name: "Hank Miller", email: "hank.miller@harborlane.example", mgr: hannah },
    { name: "Zara Ahmed", email: "zara.ahmed@harborlane.example", mgr: tomas },
    { name: "Finn Gallagher", email: "finn.gallagher@harborlane.example", mgr: tomas },
    { name: "Noor Elamin", email: "noor.elamin@harborlane.example", mgr: aisha },
    { name: "Cara Jennings", email: "cara.jennings@harborlane.example", mgr: aisha },
    { name: "Mateo Ruiz", email: "mateo.ruiz@harborlane.example", mgr: aisha },
    { name: "Tariq Mansoor", email: "tariq.mansoor@harborlane.example", mgr: greg },
    { name: "Elena Rostova", email: "elena.rostova@harborlane.example", mgr: greg },
    { name: "Jason Wu", email: "jason.wu@harborlane.example", mgr: nina },
    { name: "Aaliyah Johnson", email: "aaliyah.johnson@harborlane.example", mgr: nina },
    { name: "Oliver Scott", email: "oliver.scott@harborlane.example", mgr: nina },
    { name: "Clara Dupont", email: "clara.dupont@harborlane.example", mgr: leo },
    { name: "Darius King", email: "darius.king@harborlane.example", mgr: leo },
    { name: "Mina Kovač", email: "mina.kovac@harborlane.example", mgr: claire },
    { name: "Tobias Becker", email: "tobias.becker@harborlane.example", mgr: claire },
    { name: "Nadia Belkacem", email: "nadia.belkacem@harborlane.example", mgr: claire },
    { name: "Callum Evans", email: "callum.evans@harborlane.example", mgr: samir },
    { name: "Sora Takahashi", email: "sora.takahashi@harborlane.example", mgr: samir },
    { name: "Fiona MacLeod", email: "fiona.macleod@harborlane.example", mgr: liam },
    { name: "Gavin O'Connor", email: "gavin.oconnor@harborlane.example", mgr: liam },
    { name: "Maeve Higgins", email: "maeve.higgins@harborlane.example", mgr: liam },
    { name: "Arjun Kapoor", email: "arjun.kapoor@harborlane.example", mgr: sunita },
    { name: "Divya Nair", email: "divya.nair@harborlane.example", mgr: sunita },
    { name: "Rohan Varma", email: "rohan.varma@harborlane.example", mgr: sunita },
    { name: "Arthur Pendelton", email: "arthur.pendelton@harborlane.example", mgr: julian },
    { name: "Beatrice Thorne", email: "beatrice.thorne@harborlane.example", mgr: julian },
    { name: "Cedric Marsh", email: "cedric.marsh@harborlane.example", mgr: julian },
    { name: "Damon Hill", email: "damon.hill@harborlane.example", mgr: kendra },
    { name: "Selena Gomez-Perez", email: "selena.gp@harborlane.example", mgr: kendra },
    { name: "Victor Stone", email: "victor.stone@harborlane.example", mgr: ethan },
    { name: "Natalia Roman", email: "natalia.roman@harborlane.example", mgr: ethan },
  ];

  const associates = [ravi, june, tara, dio, luis, emma, amira, lucas, priyaSen, alexTurner, sophieChen];
  for (const item of extraAssociatesData) {
    const created = await prisma.user.create({
      data: {
        name: item.name,
        email: item.email,
        role: "associate",
        reportsToId: item.mgr.id,
        passwordHash: hash,
        emailVerifiedAt: verifiedAt,
      approvedAt: verifiedAt,
      },
    });
    associates.push(created);
  }

  // -------------------------------------------------------------
  // 2. Comprehensive Tasks Data Injection
  // -------------------------------------------------------------
  console.log("Seeding comprehensive tasks across all work kinds and visibility tiers...");

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000);
  const hoursFromNow = (h: number) => new Date(now + h * 60 * 60 * 1000);
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

  // --- Task 1: Vendor Northline missed delivery (Direct, Overdue Escalation)
  const taskVendorNorthline = await prisma.task.create({
    data: {
      title: "Vendor Northline missed DC-4 delivery window",
      description: "Inbound appointment 06:00–08:00 slipped to 14:20. Produce cooler at 8°C. Store 184 already short on mixed greens.",
      category: TaskCategory.vendor,
      workKind: WorkKind.escalation,
      priority: TaskPriority.urgent,
      dueAt: hoursAgo(2),
      createdById: sarah.id,
      visibilityType: VisibilityType.DIRECT,
      assigneeId: ravi.id,
      assignedById: sarah.id,
      boardColumn: BoardColumn.IN_PROGRESS,
      redFlag: true,
      createdAt: hoursAgo(6),
    },
  });

  await prisma.taskAccess.createMany({
    data: [
      { taskId: taskVendorNorthline.id, userId: ravi.id, grantedById: sarah.id, accessType: "ASSIGNEE" },
      { taskId: taskVendorNorthline.id, userId: marcus.id, grantedById: sarah.id, accessType: "VIEW" },
    ],
  });

  // --- Task 2: Pallet wrap failure (Team Marcus, In Progress Task)
  const taskPalletWrap = await prisma.task.create({
    data: {
      title: "Pallet wrap failure — aisle 12 frozen",
      description: "Three pallets of SKU FZ-229 shifted. Shrink wrap snapped during inbound. Re-stacking required before aisle open.",
      category: TaskCategory.inventory,
      workKind: WorkKind.task,
      priority: TaskPriority.normal,
      dueAt: hoursFromNow(6),
      createdById: marcus.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: marcus.id,
      assigneeId: june.id,
      assignedById: marcus.id,
      boardColumn: BoardColumn.IN_PROGRESS,
      createdAt: hoursAgo(3),
    },
  });

  // --- Task 3: Store 62 empty dairy bay (Global, Due Tomorrow Escalation)
  const taskDairyBay = await prisma.task.create({
    data: {
      title: "Store 62: empty dairy bay recovery",
      description: "Night fill did not land. Regional merchandiser asked for a same-day recovery plan and expedited milk delivery.",
      category: TaskCategory.escalation,
      workKind: WorkKind.escalation,
      priority: TaskPriority.high,
      dueAt: hoursFromNow(24),
      createdById: lena.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: dio.id,
      assignedById: lena.id,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(10),
    },
  });

  // --- Task 4: Weekend sorter gap (Direct, Unassigned Backlog)
  const taskSorterGap = await prisma.task.create({
    data: {
      title: "Weekend sorter gap at west cross-dock",
      description: "Need a certified sorter Saturday 22:00–06:00 at the west cross-dock. Open for qualified free-agent assignment.",
      category: TaskCategory.other,
      workKind: WorkKind.backlog,
      priority: TaskPriority.low,
      dueAt: hoursFromNow(72),
      createdById: sarah.id,
      visibilityType: VisibilityType.DIRECT,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(18),
    },
  });

  await prisma.taskAccess.createMany({
    data: [
      { taskId: taskSorterGap.id, userId: amira.id, grantedById: sarah.id, accessType: "VIEW" },
      { taskId: taskSorterGap.id, userId: lucas.id, grantedById: sarah.id, accessType: "VIEW" },
    ],
  });

  // --- Task 5: Cooler door alarm (Team Marcus, Report)
  const taskCoolerAlarm = await prisma.task.create({
    data: {
      title: "Cooler door alarm — store 184 produce section",
      description: "Door left ajar for 35 minutes after morning delivery. Temperature reached 11°C before buzzer alerted supervisor.",
      category: TaskCategory.other,
      workKind: WorkKind.report,
      priority: TaskPriority.normal,
      metadata: {
        reportType: "equipment",
        location: "Store 184 produce cooler",
        temperaturePeak: "11.2C",
        spoilageInspection: "Passed - product moved in time",
      },
      createdById: ravi.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: marcus.id,
      assigneeId: null,
      boardColumn: BoardColumn.IN_REVIEW,
      createdAt: hoursAgo(5),
    },
  });

  // --- Task 6: Store 44 freezer compressor trip (Global, Overdue Urgent Escalation)
  const taskCompressorTrip = await prisma.task.create({
    data: {
      title: "Store 44 primary walk-in freezer compressor trip",
      description: "Compressor B breaker tripped twice within 45 minutes. Ambient temperature rising past safety limits (-18C required, currently -8C).",
      category: TaskCategory.escalation,
      workKind: WorkKind.escalation,
      priority: TaskPriority.urgent,
      dueAt: hoursAgo(1),
      createdById: elena.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: luis.id,
      assignedById: elena.id,
      boardColumn: BoardColumn.IN_PROGRESS,
      redFlag: true,
      createdAt: hoursAgo(4),
    },
  });

  // --- Task 7: Sorter loop belt overheating (Global, High Escalation)
  const taskBeltOverheat = await prisma.task.create({
    data: {
      title: "DC-1 main sorter loop motor thermal warning",
      description: "Thermal sensors on motor unit 3 reporting 88°C under standard load. Line 2 throttling back throughput by 40%.",
      category: TaskCategory.other,
      workKind: WorkKind.escalation,
      priority: TaskPriority.high,
      dueAt: hoursFromNow(4),
      createdById: noah.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(2),
    },
  });

  // --- Task 8: Inbound dock inspection & bay clearing (Team Marcus, Task)
  await prisma.task.create({
    data: {
      title: "Inbound dock inspection & bay clearing — Shift A",
      description: "Perform daily 10-point staging safety check across docks 1 through 8. Clear wooden debris and empty pallets.",
      category: TaskCategory.normal,
      workKind: WorkKind.task,
      priority: TaskPriority.normal,
      dueAt: hoursFromNow(12),
      createdById: marcus.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: marcus.id,
      assigneeId: tara.id,
      assignedById: marcus.id,
      boardColumn: BoardColumn.IN_PROGRESS,
      createdAt: hoursAgo(7),
    },
  });

  // --- Task 9: POS network switch failure (Team Tomás, Overdue Escalation)
  const taskPosSwitch = await prisma.task.create({
    data: {
      title: "Store 12 front-end register switch packet drop",
      description: "Lanes 4 to 8 intermittently timing out during PIN pad transactions. Cashiers forced to reroute shoppers to express registers.",
      category: TaskCategory.customer,
      workKind: WorkKind.escalation,
      priority: TaskPriority.urgent,
      dueAt: hoursAgo(3),
      createdById: tomas.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: tomas.id,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      redFlag: true,
      createdAt: hoursAgo(8),
    },
  });

  // --- Task 10: Chemical spill aisle 4 (Global, High Safety Report)
  await prisma.task.create({
    data: {
      title: "Industrial floor cleaner spill — aisle 4 detergent bay",
      description: "5-gallon drum of concentrated sanitizer breached by clamp truck. Spill kit alpha deployed. Area taped off.",
      category: TaskCategory.other,
      workKind: WorkKind.report,
      priority: TaskPriority.high,
      metadata: {
        incidentType: "chemical_spill",
        spillKitUsed: "Alpha-4 absorbent",
        injuries: 0,
        supervisorSignoff: "Elena Rossi",
      },
      createdById: dio.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: dio.id,
      assignedById: elena.id,
      boardColumn: BoardColumn.IN_REVIEW,
      createdAt: hoursAgo(9),
    },
  });

  // --- Task 11: Free Agent task assigned by Sarah (Direct, Task)
  const taskFreeAgentSecurity = await prisma.task.create({
    data: {
      title: "Emergency egress route audit — DC-3 cross dock",
      description: "Verify that all 14 marked emergency exit pathways maintain 44-inch clear width without parked pallet jacks.",
      category: TaskCategory.normal,
      workKind: WorkKind.task,
      priority: TaskPriority.normal,
      dueAt: hoursFromNow(36),
      createdById: sarah.id,
      visibilityType: VisibilityType.DIRECT,
      assigneeId: amira.id,
      assignedById: sarah.id,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(12),
    },
  });

  await prisma.taskAccess.createMany({
    data: [
      { taskId: taskFreeAgentSecurity.id, userId: amira.id, grantedById: sarah.id, accessType: "ASSIGNEE" },
      { taskId: taskFreeAgentSecurity.id, userId: marcus.id, grantedById: sarah.id, accessType: "VIEW" },
    ],
  });

  // --- Task 12: High-velocity SKU relocation (Team Maya, Task)
  await prisma.task.create({
    data: {
      title: "Fast-mover SKU repositioning to forward pick faces",
      description: "Move top 40 velocity SKUs from upper racking tier D to ground pick levels to cut picker travel distance ahead of sale.",
      category: TaskCategory.inventory,
      workKind: WorkKind.task,
      priority: TaskPriority.normal,
      dueAt: hoursFromNow(48),
      createdById: maya.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: maya.id,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(14),
    },
  });

  // --- Task 13: Customer slip-and-fall near produce misting bay (Global, Report)
  await prisma.task.create({
    data: {
      title: "Customer slip report — Store 12 misting display",
      description: "Customer slipped on overspray dampness near organic herbs. Assisted immediately. Incident log logged with store manager.",
      category: TaskCategory.customer,
      workKind: WorkKind.report,
      priority: TaskPriority.high,
      metadata: {
        customerAssisted: true,
        firstAidOffered: true,
        firstAidAccepted: false,
        cameraFootageArchived: "CAM-04-1422",
      },
      createdById: tomas.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(16),
    },
  });

  // --- Task 14: Overstock pallet consolidation (Global, Backlog)
  await prisma.task.create({
    data: {
      title: "Overstock pallet consolidation — mezzanine sector 3",
      description: "Combine 28 partial pallets of paper products into 14 full cube pallets to free up 14 reserve storage slots.",
      category: TaskCategory.inventory,
      workKind: WorkKind.backlog,
      priority: TaskPriority.low,
      dueAt: hoursFromNow(120),
      createdById: jamal.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(24),
    },
  });

  // --- Task 15: Cardboard baler hydraulic pressure warning (Team Lena, Backlog)
  await prisma.task.create({
    data: {
      title: "Cardboard baler hydraulic seal preventive service",
      description: "Baler 2 cylinder bleeding down 10% during compression dwell. Needs vendor technician scheduled before next cycle.",
      category: TaskCategory.other,
      workKind: WorkKind.backlog,
      priority: TaskPriority.normal,
      dueAt: hoursFromNow(96),
      createdById: lena.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: lena.id,
      assigneeId: dio.id,
      assignedById: lena.id,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(30),
    },
  });

  // --- Task 16: Cold chain threshold breach truck #408 (Team Chris, Escalation)
  await prisma.task.create({
    data: {
      title: "Reefer trailer #408 data-logger temperature alert",
      description: "Sensor logged 47 minutes at 7.4°C between Hub 2 and Store 91. Quality assurance quarantine required upon arrival.",
      category: TaskCategory.vendor,
      workKind: WorkKind.escalation,
      priority: TaskPriority.high,
      dueAt: hoursAgo(5),
      createdById: chris.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: chris.id,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      redFlag: true,
      createdAt: hoursAgo(6),
    },
  });

  // --- Task 17: Handheld terminal battery reconditioning (Global, Backlog)
  await prisma.task.create({
    data: {
      title: "RF gun battery fleet cycle testing & decommissioning",
      description: "Test 60 Zebra TC57 batteries against runtime benchmark. Mark batteries dropping below 70% capacity for disposal.",
      category: TaskCategory.other,
      workKind: WorkKind.backlog,
      priority: TaskPriority.low,
      dueAt: null,
      createdById: noah.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(40),
    },
  });

  // --- Task 18: Quality discrepancy on meat supplier delivery (Direct, Escalation)
  const taskMeatQuality = await prisma.task.create({
    data: {
      title: "Supplier FreshMeats batch #FM-882 seal failure",
      description: "Vacuum seal broken on 14 cases of chicken breast tenders. Refused acceptance at inbound dock. Credit memo required.",
      category: TaskCategory.vendor,
      workKind: WorkKind.escalation,
      priority: TaskPriority.high,
      dueAt: hoursFromNow(18),
      createdById: lena.id,
      visibilityType: VisibilityType.DIRECT,
      assigneeId: emma.id,
      assignedById: lena.id,
      boardColumn: BoardColumn.IN_PROGRESS,
      createdAt: hoursAgo(15),
    },
  });

  await prisma.taskAccess.createMany({
    data: [
      { taskId: taskMeatQuality.id, userId: emma.id, grantedById: lena.id, accessType: "ASSIGNEE" },
      { taskId: taskMeatQuality.id, userId: sarah.id, grantedById: lena.id, accessType: "VIEW" },
    ],
  });

  // --- Task 19: Monthly safety eye-wash inspection (Global, Report)
  await prisma.task.create({
    data: {
      title: "Monthly OSHA eye-wash & emergency shower flow check",
      description: "Tested all 8 emergency stations in battery charging and chemical storage. All flows within regulation. Tags stamped.",
      category: TaskCategory.other,
      workKind: WorkKind.report,
      priority: TaskPriority.low,
      metadata: {
        inspectionType: "OSHA_Compliance",
        stationsTested: 8,
        stationsPassed: 8,
        nextInspectionDue: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      createdById: owen.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.DONE,
      finishedAt: hoursAgo(12),
      createdAt: hoursAgo(28),
    },
  });

  // --- Task 20: Produce display chiller temperature recovery (Team Marcus, Task, Completed)
  await prisma.task.create({
    data: {
      title: "Store 184 produce display chiller coil cleaning",
      description: "Evaporator coil was clogged with dust bunny buildup. Coil cleaned and vacuumed. Temperature returned to 3.8°C.",
      category: TaskCategory.normal,
      workKind: WorkKind.task,
      priority: TaskPriority.normal,
      dueAt: hoursAgo(8),
      createdById: marcus.id,
      visibilityType: VisibilityType.TEAM,
      visibilityManagerId: marcus.id,
      assigneeId: ravi.id,
      assignedById: marcus.id,
      boardColumn: BoardColumn.DONE,
      finishedAt: hoursAgo(4),
      createdAt: hoursAgo(20),
    },
  });

  // --- Task 21: Self-assignable unassigned global task
  await prisma.task.create({
    data: {
      title: "Aisle 9 dry goods overhead shelf re-labeling",
      description: "Replace faded barcode location tags across aisle 9 bays A through F. Any associate may pick this up.",
      category: TaskCategory.inventory,
      workKind: WorkKind.task,
      priority: TaskPriority.low,
      dueAt: hoursFromNow(48),
      createdById: marcus.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      createdAt: hoursAgo(8),
    },
  });

  // --- Task 22: High priority customer order fulfillment SLA spike (Global, Urgent Escalation)
  await prisma.task.create({
    data: {
      title: "E-commerce same-day delivery order queue spike (>400 orders)",
      description: "Omnichannel pickup queue exceeded 3-hour SLA window due to batch order surge. Need 4 pickers cross-deployed from stock team.",
      category: TaskCategory.customer,
      workKind: WorkKind.escalation,
      priority: TaskPriority.urgent,
      dueAt: hoursAgo(1),
      createdById: sarah.id,
      visibilityType: VisibilityType.GLOBAL,
      assigneeId: null,
      boardColumn: BoardColumn.TODO,
      redFlag: true,
      createdAt: hoursAgo(3),
    },
  });

  // --- Historical tasks for weekly trends chart (last 5 weeks)
  console.log("Seeding historical task trends over past 35 days...");
  const pastTrends = [
    { days: 34, title: "Q3 Safety audit — bay doors 1-4", kind: WorkKind.report, cat: TaskCategory.other, prio: TaskPriority.normal, by: sarah.id },
    { days: 33, title: "Pallet racking inspection DC-2", kind: WorkKind.task, cat: TaskCategory.inventory, prio: TaskPriority.normal, by: marcus.id },
    { days: 31, title: "Forklift hydraulic fluid leak report", kind: WorkKind.report, cat: TaskCategory.other, prio: TaskPriority.high, by: ravi.id },
    { days: 30, title: "Seasonal promo endcap setup Store 14", kind: WorkKind.task, cat: TaskCategory.normal, prio: TaskPriority.normal, by: jamal.id },
    { days: 28, title: "Overstock staging area overflow — south yard", kind: WorkKind.backlog, cat: TaskCategory.inventory, prio: TaskPriority.low, by: lena.id },
    { days: 27, title: "Supplier delivery variance — produce", kind: WorkKind.escalation, cat: TaskCategory.vendor, prio: TaskPriority.high, by: sarah.id },
    { days: 25, title: "Store 44 freezer breakdown incident", kind: WorkKind.escalation, cat: TaskCategory.other, prio: TaskPriority.urgent, by: elena.id },
    { days: 24, title: "Carton conveyor optical sensor cleanout", kind: WorkKind.task, cat: TaskCategory.other, prio: TaskPriority.normal, by: noah.id },
    { days: 22, title: "Barcode scanner firmware mismatch audit", kind: WorkKind.task, cat: TaskCategory.other, prio: TaskPriority.normal, by: marcus.id },
    { days: 21, title: "Cross-dock pallet staging congestion review", kind: WorkKind.report, cat: TaskCategory.inventory, prio: TaskPriority.normal, by: chris.id },
    { days: 20, title: "Vendor return backlog — dry goods", kind: WorkKind.backlog, cat: TaskCategory.vendor, prio: TaskPriority.low, by: lena.id },
    { days: 19, title: "Store 81 meat cooler condensation leak", kind: WorkKind.escalation, cat: TaskCategory.other, prio: TaskPriority.urgent, by: sarah.id },
    { days: 17, title: "Recycling compacting cycle log", kind: WorkKind.report, cat: TaskCategory.other, prio: TaskPriority.low, by: maya.id },
    { days: 16, title: "Supplier delivery variance — dairy delivery", kind: WorkKind.escalation, cat: TaskCategory.vendor, prio: TaskPriority.high, by: sarah.id },
    { days: 15, title: "Order picker tether harness safety replacement", kind: WorkKind.task, cat: TaskCategory.other, prio: TaskPriority.high, by: owen.id },
    { days: 14, title: "Aisle 8 shelf alignment and labeling", kind: WorkKind.task, cat: TaskCategory.normal, prio: TaskPriority.normal, by: marcus.id },
    { days: 13, title: "West cross-dock sorter slip clutch adjustment", kind: WorkKind.task, cat: TaskCategory.other, prio: TaskPriority.normal, by: noah.id },
    { days: 12, title: "Customer slip incident report — Store 12", kind: WorkKind.report, cat: TaskCategory.customer, prio: TaskPriority.high, by: tomas.id },
    { days: 11, title: "Perishables shrinkage review — Week 40", kind: WorkKind.report, cat: TaskCategory.inventory, prio: TaskPriority.normal, by: ben.id },
    { days: 10, title: "Receiving dock 6 dock-lock hydraulic repair", kind: WorkKind.escalation, cat: TaskCategory.other, prio: TaskPriority.high, by: chris.id },
    { days: 8, title: "Weekend cross-dock scheduling review", kind: WorkKind.task, cat: TaskCategory.other, prio: TaskPriority.normal, by: lena.id },
    { days: 7, title: "Emergency sprinkler check report", kind: WorkKind.report, cat: TaskCategory.other, prio: TaskPriority.normal, by: elena.id },
    { days: 6, title: "Cold room strip curtain replacement", kind: WorkKind.backlog, cat: TaskCategory.other, prio: TaskPriority.low, by: marcus.id },
    { days: 5, title: "Express lane register malfunction — Store 55", kind: WorkKind.escalation, cat: TaskCategory.customer, prio: TaskPriority.urgent, by: priyaDesai.id },
    { days: 4, title: "Dock door 2 rubber bumper seal replacement", kind: WorkKind.task, cat: TaskCategory.other, prio: TaskPriority.normal, by: noah.id },
    { days: 3, title: "Return to vendor staging area clearance", kind: WorkKind.backlog, cat: TaskCategory.vendor, prio: TaskPriority.low, by: hannah.id },
    { days: 2, title: "Shrink wrap supplier defect inquiry", kind: WorkKind.task, cat: TaskCategory.vendor, prio: TaskPriority.normal, by: lena.id },
    { days: 1, title: "Store 184 temperature alarm log verification", kind: WorkKind.report, cat: TaskCategory.other, prio: TaskPriority.normal, by: sarah.id },
  ];

  for (const item of pastTrends) {
    const pDate = daysAgo(item.days);
    await prisma.task.create({
      data: {
        title: item.title,
        description: `Operational event logged ${item.days} days ago for trend analysis, historical tracking, and queue metrics.`,
        category: item.cat,
        workKind: item.kind,
        priority: item.prio,
        createdById: item.by,
        visibilityType: VisibilityType.GLOBAL,
        createdAt: pDate,
        updatedAt: pDate,
        boardColumn: item.days > 5 ? BoardColumn.DONE : BoardColumn.IN_PROGRESS,
        finishedAt: item.days > 5 ? new Date(pDate.getTime() + 18 * 60 * 60 * 1000) : null,
      },
    });
  }

  // -------------------------------------------------------------
  // 3. Comments & Mentions
  // -------------------------------------------------------------
  console.log("Seeding task comments and user mentions...");

  const c1 = await prisma.comment.create({
    data: {
      taskId: taskVendorNorthline.id,
      authorId: sarah.id,
      body: "Ravi: Please coordinate with receiver at bay 3 immediately. Check core temp of greens before accepting delivery.",
      createdAt: hoursAgo(5),
    },
  });

  const c2 = await prisma.comment.create({
    data: {
      taskId: taskVendorNorthline.id,
      authorId: ravi.id,
      body: "@sarah.okonkwo Truck just pulled into dock. Core probe reading 6.8°C — right on the upper threshold. Checking center pallets now.",
      createdAt: hoursAgo(3),
    },
  });

  await prisma.mention.create({
    data: {
      commentId: c2.id,
      mentionedUserId: sarah.id,
      createdAt: hoursAgo(3),
    },
  });

  const c3 = await prisma.comment.create({
    data: {
      taskId: taskVendorNorthline.id,
      authorId: marcus.id,
      body: "Logged vendor penalty charge with dispatch. If temp rises past 7.5°C, refuse batch.",
      createdAt: hoursAgo(2),
    },
  });

  const c4 = await prisma.comment.create({
    data: {
      taskId: taskCompressorTrip.id,
      authorId: elena.id,
      body: "@luis.ortega Compressor cooling fins are heavily frosted. Initiate manual defrost cycle before resetting main breaker.",
      createdAt: hoursAgo(3),
    },
  });

  await prisma.mention.create({
    data: {
      commentId: c4.id,
      mentionedUserId: luis.id,
      createdAt: hoursAgo(3),
    },
  });

  await prisma.comment.create({
    data: {
      taskId: taskPosSwitch.id,
      authorId: tomas.id,
      body: "Store technician on site. Rebooted PoE switch. Monitoring ping stability for the next 30 minutes.",
      createdAt: hoursAgo(2),
    },
  });

  // -------------------------------------------------------------
  // 4. Conversations & Live Messages (Global + 1:1 DMs)
  // -------------------------------------------------------------
  console.log("Seeding global chat and direct message threads...");

  // Global Chat
  const globalConv = await prisma.conversation.create({
    data: {
      type: "GLOBAL",
      createdById: sarah.id,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: globalConv.id,
        senderId: sarah.id,
        body: "Morning team. Inbound logistics at DC-4 is running with a 2-hour delay on cold chain produce. Keep eyes on dairy and salad queues.",
        createdAt: hoursAgo(7),
      },
      {
        conversationId: globalConv.id,
        senderId: marcus.id,
        body: "Understood. My associates Ravi and June are monitoring dock temperatures. Pallet wrap station is also being cleared.",
        createdAt: hoursAgo(6),
      },
      {
        conversationId: globalConv.id,
        senderId: ravi.id,
        body: "Northline missed DC-4 again. Produce cooler was climbing but we staged backup dry ice. Task is open and logged.",
        createdAt: hoursAgo(5),
      },
      {
        conversationId: globalConv.id,
        senderId: elena.id,
        body: "Safety notice for all DC managers: Floor scrubbers are active on South aisle 3-5. Ensure cones and non-slip mats are deployed.",
        createdAt: hoursAgo(4),
      },
      {
        conversationId: globalConv.id,
        senderId: noah.id,
        body: "Cross-dock sorter loop 3 is throttling at 88°C. Tech team is inspecting the drive pulley now.",
        createdAt: hoursAgo(2),
      },
      {
        conversationId: globalConv.id,
        senderId: amira.id,
        body: "Free agent standing by at west cross-dock. Available for extra sorting shift if needed.",
        createdAt: hoursAgo(1),
      },
    ],
  });

  // 1:1 DM: Sarah (Lead) & Marcus (Manager)
  const dmSarahMarcus = await prisma.conversation.create({
    data: {
      type: "DM",
      createdById: sarah.id,
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: dmSarahMarcus.id, userId: sarah.id, joinedAt: hoursAgo(12) },
      { conversationId: dmSarahMarcus.id, userId: marcus.id, joinedAt: hoursAgo(12) },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: dmSarahMarcus.id,
        senderId: sarah.id,
        body: "Marcus, how is your team pacing with the aisle 12 restack?",
        createdAt: hoursAgo(4),
      },
      {
        conversationId: dmSarahMarcus.id,
        senderId: marcus.id,
        body: "June has two pallets finished. Third pallet is almost complete. Should be done well before the shift handover.",
        createdAt: hoursAgo(3),
      },
      {
        conversationId: dmSarahMarcus.id,
        senderId: sarah.id,
        body: "Great job. Keep Ravi focused on the Northline trailer delivery.",
        createdAt: hoursAgo(2),
      },
    ],
  });

  // 1:1 DM: Marcus (Manager) & Ravi (Associate)
  const dmMarcusRavi = await prisma.conversation.create({
    data: {
      type: "DM",
      createdById: marcus.id,
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: dmMarcusRavi.id, userId: marcus.id, joinedAt: hoursAgo(10) },
      { conversationId: dmMarcusRavi.id, userId: ravi.id, joinedAt: hoursAgo(10) },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: dmMarcusRavi.id,
        senderId: marcus.id,
        body: "Ravi, make sure you take photos of the temperature logger on the Northline reefer.",
        createdAt: hoursAgo(4),
      },
      {
        conversationId: dmMarcusRavi.id,
        senderId: ravi.id,
        body: "Already done Marcus! Uploaded the readings to the task report. Everything is under control.",
        createdAt: hoursAgo(2),
      },
    ],
  });

  // 1:1 DM: Sarah (Lead) & Amira (Free Agent Associate)
  const dmSarahAmira = await prisma.conversation.create({
    data: {
      type: "DM",
      createdById: sarah.id,
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: dmSarahAmira.id, userId: sarah.id, joinedAt: hoursAgo(8) },
      { conversationId: dmSarahAmira.id, userId: amira.id, joinedAt: hoursAgo(8) },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: dmSarahAmira.id,
        senderId: sarah.id,
        body: "Hi Amira, I assigned the DC-3 cross-dock emergency egress audit directly to you.",
        createdAt: hoursAgo(6),
      },
      {
        conversationId: dmSarahAmira.id,
        senderId: amira.id,
        body: "Received Sarah! I will complete the physical walkthrough this afternoon.",
        createdAt: hoursAgo(5),
      },
    ],
  });

  // -------------------------------------------------------------
  // 5. Notifications
  // -------------------------------------------------------------
  console.log("Seeding in-app notifications...");

  await prisma.notification.createMany({
    data: [
      {
        recipientId: ravi.id,
        type: "task_assigned",
        taskId: taskVendorNorthline.id,
        actorId: sarah.id,
        createdAt: hoursAgo(6),
      },
      {
        recipientId: sarah.id,
        type: "mention",
        taskId: taskVendorNorthline.id,
        actorId: ravi.id,
        createdAt: hoursAgo(3),
      },
      {
        recipientId: luis.id,
        type: "mention",
        taskId: taskCompressorTrip.id,
        actorId: elena.id,
        createdAt: hoursAgo(3),
      },
      {
        recipientId: amira.id,
        type: "task_assigned",
        taskId: taskFreeAgentSecurity.id,
        actorId: sarah.id,
        createdAt: hoursAgo(12),
      },
      {
        recipientId: dio.id,
        type: "task_assigned",
        taskId: taskDairyBay.id,
        actorId: lena.id,
        createdAt: hoursAgo(10),
      },
    ],
  });

  // -------------------------------------------------------------
  // 6. Audit Trail Events
  // -------------------------------------------------------------
  console.log("Seeding audit trail events...");

  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: sarah.id,
        action: "task.created",
        entityType: "task",
        entityId: taskVendorNorthline.id,
        metadata: { title: taskVendorNorthline.title, priority: "urgent", visibility: "DIRECT" },
        createdAt: hoursAgo(6),
      },
      {
        actorId: sarah.id,
        action: "task.assigned",
        entityType: "task",
        entityId: taskVendorNorthline.id,
        metadata: { assigneeId: ravi.id, assigneeName: "Ravi Mehta" },
        createdAt: hoursAgo(6),
      },
      {
        actorId: marcus.id,
        action: "task.created",
        entityType: "task",
        entityId: taskPalletWrap.id,
        metadata: { title: taskPalletWrap.title, visibility: "TEAM" },
        createdAt: hoursAgo(3),
      },
      {
        actorId: elena.id,
        action: "task.created",
        entityType: "task",
        entityId: taskCompressorTrip.id,
        metadata: { title: taskCompressorTrip.title, priority: "urgent" },
        createdAt: hoursAgo(4),
      },
    ],
  });

  // -------------------------------------------------------------
  // 7. Feature Flags
  // -------------------------------------------------------------
  await prisma.featureFlag.createMany({
    data: [
      { key: "ai", enabled: true },
      { key: "knowledge_base", enabled: false },
    ],
  });

  // Summary printout
  const userCounts = await prisma.user.groupBy({ by: ["role"], _count: true });
  const taskCounts = await prisma.task.groupBy({ by: ["workKind"], _count: true });
  const totalTasks = await prisma.task.count();

  console.log("\n========================================================");
  console.log("✅ OpsNinja Demo Database Successfully Injected & Seeded!");
  console.log("Default password for all seeded accounts:", password);
  console.log("--------------------------------------------------------");
  console.log("Headcount by Role:", Object.fromEntries(userCounts.map((c) => [c.role, c._count])));
  console.log("Tasks by WorkKind:", Object.fromEntries(taskCounts.map((c) => [c.workKind, c._count])));
  console.log("Total Tasks in System:", totalTasks);
  console.log("--------------------------------------------------------");
  console.log("Sample Login Credentials:");
  console.log("  • Lead (Org-wide):        sarah.okonkwo@harborlane.example");
  console.log("  • Lead (Supply Chain):     noah.kim@harborlane.example");
  console.log("  • Lead (Quality & Safety): elena.rossi@harborlane.example");
  console.log("  • Manager (Team Marcus):   marcus.hale@harborlane.example");
  console.log("  • Manager (Team Lena):     lena.vogel@harborlane.example");
  console.log("  • Associate (Marcus Team): ravi.mehta@harborlane.example");
  console.log("  • Associate (Marcus Team): june.park@harborlane.example");
  console.log("  • Associate (Lena Team):   dio.santos@harborlane.example");
  console.log("  • Free Agent Associate:    amira.hassan@harborlane.example");
  console.log("  • Platform Admin:          priya.nair@harborlane.example");
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error("Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
