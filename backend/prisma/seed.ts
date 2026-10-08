import { hashPassword } from "../src/lib/password.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const password = "Harborlane!26";

async function main() {
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

  const hash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      email: "priya.nair@harborlane.example",
      name: "Priya Nair",
      role: "admin",
      passwordHash: hash,
    },
  });

  const sarah = await prisma.user.create({
    data: {
      email: "sarah.okonkwo@harborlane.example",
      name: "Sarah Okonkwo",
      role: "lead",
      passwordHash: hash,
    },
  });

  const marcus = await prisma.user.create({
    data: {
      email: "marcus.hale@harborlane.example",
      name: "Marcus Hale",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
    },
  });

  const lena = await prisma.user.create({
    data: {
      email: "lena.vogel@harborlane.example",
      name: "Lena Vogel",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
    },
  });

  const ravi = await prisma.user.create({
    data: {
      email: "ravi.mehta@harborlane.example",
      name: "Ravi Mehta",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
    },
  });

  const june = await prisma.user.create({
    data: {
      email: "june.park@harborlane.example",
      name: "June Park",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
    },
  });

  const dio = await prisma.user.create({
    data: {
      email: "dio.santos@harborlane.example",
      name: "Dio Santos",
      role: "associate",
      reportsToId: lena.id,
      passwordHash: hash,
    },
  });

  const amira = await prisma.user.create({
    data: {
      email: "amira.hassan@harborlane.example",
      name: "Amira Hassan",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
    },
  });

  const extraLeads = [
    ["Noah Kim", "noah.kim@harborlane.example"],
    ["Elena Rossi", "elena.rossi@harborlane.example"],
    ["Jamal Wright", "jamal.wright@harborlane.example"],
    ["Priya Desai", "priya.desai@harborlane.example"],
  ] as const;
  const moreLeads = [];
  for (const [name, email] of extraLeads) {
    moreLeads.push(await prisma.user.create({ data: { name, email, role: "lead", passwordHash: hash } }));
  }
  const leads = [sarah, ...moreLeads];

  const extraManagers = [
    ["Chris Dalton", "chris.dalton@harborlane.example"],
    ["Maya Chen", "maya.chen@harborlane.example"],
    ["Owen Blake", "owen.blake@harborlane.example"],
    ["Sofia Alvarez", "sofia.alvarez@harborlane.example"],
    ["Ben Okoye", "ben.okoye@harborlane.example"],
    ["Hannah Lee", "hannah.lee@harborlane.example"],
    ["Tomás Silva", "tomas.silva@harborlane.example"],
    ["Aisha Rahman", "aisha.rahman@harborlane.example"],
    ["Greg Walsh", "greg.walsh@harborlane.example"],
    ["Nina Patel", "nina.patel@harborlane.example"],
    ["Leo Nakamura", "leo.nakamura@harborlane.example"],
    ["Claire Dubois", "claire.dubois@harborlane.example"],
    ["Samir Haddad", "samir.haddad@harborlane.example"],
  ] as const;
  const moreManagers = [];
  for (let i = 0; i < extraManagers.length; i++) {
    const [name, email] = extraManagers[i];
    moreManagers.push(
      await prisma.user.create({
        data: { name, email, role: "manager", reportsToId: leads[i % leads.length].id, passwordHash: hash },
      }),
    );
  }
  const managers = [marcus, lena, ...moreManagers];

  const extraAssociates = [
    ["Tara Singh", "tara.singh@harborlane.example"],
    ["Luis Ortega", "luis.ortega@harborlane.example"],
    ["Emma Brooks", "emma.brooks@harborlane.example"],
    ["Kai Nakamura", "kai.nakamura@harborlane.example"],
    ["Nora Feldman", "nora.feldman@harborlane.example"],
    ["Ibrahim Saleh", "ibrahim.saleh@harborlane.example"],
    ["Chloe Martin", "chloe.martin@harborlane.example"],
    ["Andre Cole", "andre.cole@harborlane.example"],
    ["Yuki Tanaka", "yuki.tanaka@harborlane.example"],
    ["Paula Mendes", "paula.mendes@harborlane.example"],
    ["Ryan Foster", "ryan.foster@harborlane.example"],
    ["Mei Lin", "mei.lin@harborlane.example"],
    ["Omar Farouk", "omar.farouk@harborlane.example"],
    ["Grace Okafor", "grace.okafor@harborlane.example"],
    ["Pavel Novak", "pavel.novak@harborlane.example"],
    ["Jade Nguyen", "jade.nguyen@harborlane.example"],
    ["Seth Cohen", "seth.cohen@harborlane.example"],
    ["Ines Moreau", "ines.moreau@harborlane.example"],
    ["Diego Vargas", "diego.vargas@harborlane.example"],
    ["Lila Shah", "lila.shah@harborlane.example"],
    ["Hank Miller", "hank.miller@harborlane.example"],
    ["Zara Ahmed", "zara.ahmed@harborlane.example"],
    ["Finn Gallagher", "finn.gallagher@harborlane.example"],
    ["Noor Elamin", "noor.elamin@harborlane.example"],
    ["Cara Jennings", "cara.jennings@harborlane.example"],
    ["Mateo Ruiz", "mateo.ruiz@harborlane.example"],
  ] as const;
  for (let i = 0; i < extraAssociates.length; i++) {
    const [name, email] = extraAssociates[i];
    const freeAgent = i >= extraAssociates.length - 3;
    await prisma.user.create({
      data: {
        name,
        email,
        role: "associate",
        reportsToId: freeAgent ? null : managers[i % managers.length].id,
        passwordHash: hash,
      },
    });
  }

  const vendorMiss = await prisma.task.create({
    data: {
      title: "Vendor Northline missed DC-4 delivery window",
      description:
        "Inbound appointment 06:00–08:00 slipped to 14:20. Produce cooler at 8°C. Store 184 already short on mixed greens.",
      category: "vendor",
      workKind: "escalation",
      priority: "urgent",
      dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      createdById: sarah.id,
      visibilityType: "DIRECT",
      assigneeId: ravi.id,
      assignedById: sarah.id,
    },
  });
  await prisma.taskAccess.createMany({
    data: [
      { taskId: vendorMiss.id, userId: ravi.id, grantedById: sarah.id, accessType: "ASSIGNEE" },
      { taskId: vendorMiss.id, userId: marcus.id, grantedById: sarah.id, accessType: "VIEW" },
    ],
  });

  await prisma.task.create({
    data: {
      title: "Pallet wrap failure — aisle 12 frozen",
      description: "Three pallets of SKU FZ-229 shifted. Shrink wrap snapped during inbound. No injuries.",
      category: "inventory",
      workKind: "task",
      createdById: marcus.id,
      visibilityType: "TEAM",
      visibilityManagerId: marcus.id,
      assigneeId: june.id,
      assignedById: marcus.id,
    },
  });

  await prisma.task.create({
    data: {
      title: "Store 62: empty dairy bay recovery",
      description: "Night fill did not land. Regional merchandiser asked for a same-day recovery plan.",
      category: "escalation",
      workKind: "escalation",
      priority: "high",
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdById: lena.id,
      visibilityType: "GLOBAL",
      assigneeId: dio.id,
      assignedById: lena.id,
    },
  });

  await prisma.task.create({
    data: {
      title: "Weekend sorter gap at west cross-dock",
      description: "Need a trained sorter Saturday 22:00–06:00 at the west cross-dock. Not tied to a standing team.",
      category: "other",
      workKind: "backlog",
      priority: "low",
      createdById: sarah.id,
      visibilityType: "DIRECT",
      assigneeId: null,
    },
  });

  await prisma.task.create({
    data: {
      title: "Cooler door alarm — store 184",
      description: "Door left ajar after inbound. Temperature recovered. Logged for facilities follow-up.",
      category: "other",
      workKind: "report",
      metadata: {
        reportType: "equipment",
        location: "Store 184 produce cooler",
        occurredAt: new Date().toISOString(),
      },
      createdById: ravi.id,
      visibilityType: "TEAM",
      visibilityManagerId: marcus.id,
    },
  });

  // Seed historical tasks across past weeks for line chart trends
  const pastDays = [
    { daysAgo: 35, title: "Q3 Safety audit — bay doors 1-4", kind: "report", category: "other", priority: "normal", by: sarah.id, vis: "GLOBAL" as const },
    { daysAgo: 33, title: "Pallet racking inspection DC-2", kind: "task", category: "inventory", priority: "normal", by: marcus.id, vis: "GLOBAL" as const },
    { daysAgo: 30, title: "Forklift hydraulic fluid leak report", kind: "report", category: "other", priority: "high", by: ravi.id, vis: "GLOBAL" as const },
    { daysAgo: 28, title: "Overstock staging area overflow", kind: "backlog", category: "inventory", priority: "low", by: lena.id, vis: "GLOBAL" as const },
    { daysAgo: 25, title: "Store 44 freezer breakdown incident", kind: "escalation", category: "other", priority: "urgent", by: sarah.id, vis: "GLOBAL" as const },
    { daysAgo: 22, title: "Barcode scanner firmware mismatch", kind: "task", category: "other", priority: "normal", by: marcus.id, vis: "GLOBAL" as const },
    { daysAgo: 20, title: "Vendor return backlog — dry goods", kind: "backlog", category: "vendor", priority: "low", by: lena.id, vis: "GLOBAL" as const },
    { daysAgo: 16, title: "Supplier delivery variance — dairy", kind: "escalation", category: "vendor", priority: "high", by: sarah.id, vis: "GLOBAL" as const },
    { daysAgo: 14, title: "Aisle 8 shelf alignment and labeling", kind: "task", category: "normal", priority: "normal", by: marcus.id, vis: "GLOBAL" as const },
    { daysAgo: 12, title: "Customer slip incident report — Store 12", kind: "report", category: "customer", priority: "high", by: ravi.id, vis: "GLOBAL" as const },
    { daysAgo: 8, title: "Weekend cross-dock scheduling review", kind: "task", category: "other", priority: "normal", by: lena.id, vis: "GLOBAL" as const },
    { daysAgo: 7, title: "Emergency sprinkler check report", kind: "report", category: "other", priority: "normal", by: sarah.id, vis: "GLOBAL" as const },
    { daysAgo: 4, title: "Express lane register malfunction", kind: "escalation", category: "customer", priority: "urgent", by: marcus.id, vis: "GLOBAL" as const },
    { daysAgo: 2, title: "Shrink wrap supplier defect inquiry", kind: "task", category: "vendor", priority: "normal", by: lena.id, vis: "GLOBAL" as const },
  ];

  for (const item of pastDays) {
    const pastDate = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.task.create({
      data: {
        title: item.title,
        description: `Operational record logged ${item.daysAgo} days ago for pattern tracking and history.`,
        category: item.category,
        workKind: item.kind,
        priority: item.priority,
        createdById: item.by,
        visibilityType: item.vis,
        createdAt: pastDate,
        updatedAt: pastDate,
        finishedAt: item.daysAgo > 10 ? new Date(pastDate.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
      },
    });
  }

  const global = await prisma.conversation.create({ data: { type: "GLOBAL" } });
  await prisma.message.create({
    data: {
      conversationId: global.id,
      senderId: ravi.id,
      body: "Northline missed DC-4 again. Cooler is climbing. Opening a task if Sarah has not already.",
    },
  });
  await prisma.message.create({
    data: {
      conversationId: global.id,
      senderId: sarah.id,
      body: "I routed it direct to Ravi. Marcus, you will get the notification but the task is not team-wide.",
    },
  });

  await prisma.featureFlag.createMany({
    data: [
      { key: "ai", enabled: false },
      { key: "knowledge_base", enabled: false },
    ],
  });

  const counts = await prisma.user.groupBy({ by: ["role"], _count: true });
  console.log("Seeded Harborlane demo. Password for all users:", password);
  console.log("Lead:", sarah.email, "Manager:", marcus.email, "Associate:", ravi.email, "Free agent:", amira.email, "Admin:", admin.email);
  console.log("Headcount:", Object.fromEntries(counts.map((c) => [c.role, c._count])));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
